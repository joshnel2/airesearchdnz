#!/usr/bin/env python3
"""
Legal Case Ingestion Script
Fetches cases from CourtListener and populates Azure AI Search

Usage:
    python ingest_cases.py --court ca9 --date 2024-01-01 --max-cases 100
"""

import os
import sys
import argparse
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import pipeline components (from implementation plan)
from courtlistener_client import CourtListenerClient
from case_chunker import CaseLawChunker
from azure_embedding import AzureEmbeddingService
from azure_search_manager import AzureSearchIndexManager


class LegalCaseIngestionPipeline:
    """Complete pipeline for ingesting cases into Azure AI Search"""
    
    def __init__(
        self,
        courtlistener_api_token: str,
        azure_search_endpoint: str,
        azure_search_api_key: str,
        azure_openai_endpoint: str,
        azure_openai_api_key: str,
        index_name: str = "legal-cases-index"
    ):
        """Initialize all components"""
        print("Initializing ingestion pipeline...")
        
        self.courtlistener = CourtListenerClient(courtlistener_api_token)
        self.chunker = CaseLawChunker(chunk_size=512, chunk_overlap=50)
        self.embedding_service = AzureEmbeddingService(
            endpoint=azure_openai_endpoint,
            api_key=azure_openai_api_key
        )
        self.index_manager = AzureSearchIndexManager(
            endpoint=azure_search_endpoint,
            api_key=azure_search_api_key,
            index_name=index_name
        )
        
        print("✓ Pipeline initialized\n")
    
    def setup_index(self, force_recreate: bool = False):
        """Create Azure AI Search index"""
        print("Setting up Azure AI Search index...")
        
        if force_recreate:
            try:
                print("  Deleting existing index...")
                self.index_manager.delete_index()
            except:
                pass  # Index might not exist
        
        self.index_manager.create_index()
        print("✓ Index ready\n")
    
    def ingest_cases(
        self,
        court: str,
        filed_after: str,
        max_cases: int = 100,
        dry_run: bool = False
    ):
        """
        Complete ingestion pipeline
        
        Args:
            court: Court identifier (e.g., 'ca9')
            filed_after: Start date (YYYY-MM-DD)
            max_cases: Maximum cases to ingest
            dry_run: If True, don't upload to Azure
        """
        print(f"{'='*60}")
        print(f"  Legal Case Ingestion Pipeline")
        print(f"{'='*60}")
        print(f"Court:        {court}")
        print(f"Filed After:  {filed_after}")
        print(f"Max Cases:    {max_cases}")
        print(f"Dry Run:      {dry_run}")
        print(f"{'='*60}\n")
        
        start_time = datetime.now()
        
        # Step 1: Fetch cases from CourtListener
        print(f"[1/4] Fetching cases from CourtListener API...")
        print(f"      URL: https://www.courtlistener.com/api/rest/v3/opinions/")
        
        try:
            opinions = self.courtlistener.fetch_all_opinions_paginated(
                court=court,
                filed_after=filed_after,
                max_cases=max_cases
            )
            print(f"      ✓ Fetched {len(opinions)} opinions")
        except Exception as e:
            print(f"      ✗ Error: {e}")
            return None
        
        if not opinions:
            print("      ⚠ No opinions found")
            return None
        
        print()
        
        # Step 2: Chunk all cases
        print(f"[2/4] Chunking case text...")
        print(f"      Chunk size: 512 tokens, Overlap: 50 tokens")
        
        all_chunks = []
        failed_opinions = []
        
        for i, opinion in enumerate(opinions):
            try:
                chunks = self.chunker.process_opinion(opinion)
                all_chunks.extend(chunks)
                
                case_name = opinion.get('case_name', 'Unknown')
                print(f"      [{i+1:3d}/{len(opinions)}] {case_name[:50]:<50} → {len(chunks):2d} chunks")
                
            except Exception as e:
                failed_opinions.append((opinion.get('id'), str(e)))
                print(f"      [{i+1:3d}/{len(opinions)}] ✗ Error processing opinion {opinion.get('id')}: {e}")
        
        print(f"      ✓ Created {len(all_chunks)} total chunks")
        if failed_opinions:
            print(f"      ⚠ Failed to process {len(failed_opinions)} opinions")
        
        print()
        
        # Step 3: Generate embeddings
        print(f"[3/4] Generating embeddings with Azure OpenAI...")
        print(f"      Model: text-embedding-ada-002 (1536 dimensions)")
        
        try:
            chunks_with_embeddings = self.embedding_service.embed_chunks(all_chunks)
            print(f"      ✓ Generated {len(chunks_with_embeddings)} embeddings")
        except Exception as e:
            print(f"      ✗ Error: {e}")
            return None
        
        print()
        
        # Step 4: Upload to Azure AI Search
        if dry_run:
            print(f"[4/4] Skipping upload (dry run mode)")
            print(f"      Would upload {len(chunks_with_embeddings)} documents")
        else:
            print(f"[4/4] Uploading to Azure AI Search...")
            print(f"      Index: {self.index_manager.index_name}")
            print(f"      Batch size: 100 documents")
            
            # Prepare documents
            documents = []
            for chunk in chunks_with_embeddings:
                doc = {
                    'id': chunk['chunk_id'],
                    'case_id': str(chunk['case_id']),
                    'case_name': chunk['case_name'],
                    'citation': chunk['citation'],
                    'court': chunk['court'],
                    'date_filed': chunk.get('date_filed') or '1900-01-01T00:00:00Z',
                    'jurisdiction': chunk['jurisdiction'],
                    'content': chunk['content'],
                    'content_vector': chunk['content_vector'],
                    'url': chunk['url'],
                    'chunk_index': chunk['chunk_index'],
                    'total_chunks': chunk['total_chunks']
                }
                documents.append(doc)
            
            try:
                upload_stats = self.index_manager.upload_documents(documents, batch_size=100)
                print(f"      ✓ Upload complete")
            except Exception as e:
                print(f"      ✗ Error: {e}")
                upload_stats = {'uploaded': 0, 'failed': len(documents)}
        
        print()
        
        # Summary
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        print(f"{'='*60}")
        print(f"  Ingestion Summary")
        print(f"{'='*60}")
        print(f"Total Cases:         {len(opinions)}")
        print(f"Total Chunks:        {len(all_chunks)}")
        print(f"Failed Processing:   {len(failed_opinions)}")
        
        if not dry_run:
            print(f"Uploaded:            {upload_stats['uploaded']}")
            print(f"Failed Upload:       {upload_stats['failed']}")
            print(f"Success Rate:        {upload_stats['success_rate']:.1%}")
        
        print(f"Duration:            {duration:.1f} seconds")
        print(f"{'='*60}\n")
        
        return {
            'total_cases': len(opinions),
            'total_chunks': len(all_chunks),
            'failed_processing': len(failed_opinions),
            'duration_seconds': duration,
            **(upload_stats if not dry_run else {'uploaded': 0, 'failed': 0})
        }


def main():
    """Main execution"""
    parser = argparse.ArgumentParser(
        description='Ingest legal cases from CourtListener into Azure AI Search'
    )
    
    parser.add_argument(
        '--court',
        type=str,
        required=True,
        help='Court identifier (e.g., ca9, scotus, cadc)'
    )
    
    parser.add_argument(
        '--date',
        type=str,
        required=True,
        help='Start date in YYYY-MM-DD format'
    )
    
    parser.add_argument(
        '--max-cases',
        type=int,
        default=100,
        help='Maximum number of cases to ingest (default: 100)'
    )
    
    parser.add_argument(
        '--index-name',
        type=str,
        default='legal-cases-index',
        help='Azure AI Search index name (default: legal-cases-index)'
    )
    
    parser.add_argument(
        '--setup-index',
        action='store_true',
        help='Create/recreate the search index before ingestion'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Process data but do not upload to Azure'
    )
    
    args = parser.parse_args()
    
    # Validate date format
    try:
        datetime.strptime(args.date, '%Y-%m-%d')
    except ValueError:
        print(f"Error: Invalid date format '{args.date}'. Use YYYY-MM-DD")
        sys.exit(1)
    
    # Load credentials from environment
    required_env_vars = [
        'COURTLISTENER_API_TOKEN',
        'AZURE_SEARCH_ENDPOINT',
        'AZURE_SEARCH_API_KEY',
        'AZURE_OPENAI_ENDPOINT',
        'AZURE_OPENAI_API_KEY'
    ]
    
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    
    if missing_vars:
        print("Error: Missing required environment variables:")
        for var in missing_vars:
            print(f"  - {var}")
        print("\nSet these in your .env file or environment")
        sys.exit(1)
    
    # Initialize pipeline
    try:
        pipeline = LegalCaseIngestionPipeline(
            courtlistener_api_token=os.getenv('COURTLISTENER_API_TOKEN'),
            azure_search_endpoint=os.getenv('AZURE_SEARCH_ENDPOINT'),
            azure_search_api_key=os.getenv('AZURE_SEARCH_API_KEY'),
            azure_openai_endpoint=os.getenv('AZURE_OPENAI_ENDPOINT'),
            azure_openai_api_key=os.getenv('AZURE_OPENAI_API_KEY'),
            index_name=args.index_name
        )
    except Exception as e:
        print(f"Error initializing pipeline: {e}")
        sys.exit(1)
    
    # Setup index if requested
    if args.setup_index:
        try:
            pipeline.setup_index(force_recreate=True)
        except Exception as e:
            print(f"Error setting up index: {e}")
            sys.exit(1)
    
    # Run ingestion
    try:
        stats = pipeline.ingest_cases(
            court=args.court,
            filed_after=args.date,
            max_cases=args.max_cases,
            dry_run=args.dry_run
        )
        
        if stats:
            print("✓ Ingestion completed successfully")
            sys.exit(0)
        else:
            print("✗ Ingestion failed")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\n✗ Ingestion interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Ingestion failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
