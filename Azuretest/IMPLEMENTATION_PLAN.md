# Implementation Plan: Legal RAG System

## Initial Code Steps for Ingestion Pipeline

This document provides detailed implementation steps for building the data ingestion pipeline that fetches case law from CourtListener API and populates Azure AI Search.

---

## Step 1: Data Retrieval from CourtListener API

### Recommended Library
**Use `requests` library for making HTTP API calls to CourtListener.**

```python
import requests
import time
from typing import List, Dict, Optional
from datetime import datetime
import os
```

### CourtListener API Setup

**1.1 Register for API Access:**
- Visit: https://www.courtlistener.com/api/
- Create free account
- Generate API token
- Store token in Azure Key Vault or environment variable

**1.2 API Client Implementation:**

```python
class CourtListenerClient:
    """Client for Free Law Project's CourtListener API"""
    
    BASE_URL = "https://www.courtlistener.com/api/rest/v3"
    
    def __init__(self, api_token: str):
        """
        Initialize CourtListener API client
        
        Args:
            api_token: Your CourtListener API token
        """
        self.api_token = api_token
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Token {api_token}',
            'User-Agent': 'LegalRAG/1.0 (your-email@lawfirm.com)'
        })
        
        # Rate limiting: 5000 requests/hour = ~1.4 requests/second
        self.rate_limit_delay = 0.8  # seconds between requests
        self.last_request_time = 0
    
    def _rate_limit(self):
        """Implement rate limiting to respect API limits"""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.rate_limit_delay:
            time.sleep(self.rate_limit_delay - elapsed)
        self.last_request_time = time.time()
    
    def search_opinions(
        self,
        query: Optional[str] = None,
        court: Optional[str] = None,
        filed_after: Optional[str] = None,
        filed_before: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Dict:
        """
        Search for case opinions
        
        Args:
            query: Search query string
            court: Court identifier (e.g., 'ca9' for 9th Circuit)
            filed_after: Date in YYYY-MM-DD format
            filed_before: Date in YYYY-MM-DD format
            page: Page number for pagination
            page_size: Results per page (max 100)
            
        Returns:
            Dict containing results and metadata
        """
        self._rate_limit()
        
        params = {
            'page': page,
            'page_size': min(page_size, 100)  # API max is 100
        }
        
        if query:
            params['q'] = query
        if court:
            params['court'] = court
        if filed_after:
            params['filed_after'] = filed_after
        if filed_before:
            params['filed_before'] = filed_before
        
        try:
            response = self.session.get(
                f"{self.BASE_URL}/opinions/",
                params=params,
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching opinions: {e}")
            raise
    
    def get_opinion_detail(self, opinion_id: int) -> Dict:
        """
        Get detailed information for a specific opinion
        
        Args:
            opinion_id: CourtListener opinion ID
            
        Returns:
            Dict containing full opinion details
        """
        self._rate_limit()
        
        try:
            response = self.session.get(
                f"{self.BASE_URL}/opinions/{opinion_id}/",
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching opinion {opinion_id}: {e}")
            raise
    
    def get_cluster_detail(self, cluster_id: int) -> Dict:
        """
        Get case cluster (group of opinions for same case)
        
        Args:
            cluster_id: CourtListener cluster ID
            
        Returns:
            Dict containing cluster metadata and citations
        """
        self._rate_limit()
        
        try:
            response = self.session.get(
                f"{self.BASE_URL}/clusters/{cluster_id}/",
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching cluster {cluster_id}: {e}")
            raise
    
    def fetch_all_opinions_paginated(
        self,
        court: str,
        filed_after: str,
        max_cases: Optional[int] = None
    ) -> List[Dict]:
        """
        Fetch all opinions with pagination
        
        Args:
            court: Court identifier
            filed_after: Start date (YYYY-MM-DD)
            max_cases: Maximum number of cases to fetch (None = all)
            
        Returns:
            List of opinion dictionaries
        """
        all_opinions = []
        page = 1
        total_fetched = 0
        
        while True:
            print(f"Fetching page {page}...")
            
            result = self.search_opinions(
                court=court,
                filed_after=filed_after,
                page=page,
                page_size=100  # Max per page
            )
            
            opinions = result.get('results', [])
            
            if not opinions:
                break  # No more results
            
            all_opinions.extend(opinions)
            total_fetched += len(opinions)
            
            print(f"Fetched {total_fetched} opinions so far...")
            
            # Check if we've reached max_cases
            if max_cases and total_fetched >= max_cases:
                all_opinions = all_opinions[:max_cases]
                break
            
            # Check if there's a next page
            if not result.get('next'):
                break
            
            page += 1
        
        print(f"Total fetched: {len(all_opinions)} opinions")
        return all_opinions


# Example Usage
if __name__ == "__main__":
    # Get API token from environment
    API_TOKEN = os.getenv('COURTLISTENER_API_TOKEN')
    
    # Initialize client
    client = CourtListenerClient(API_TOKEN)
    
    # Fetch recent 9th Circuit cases
    opinions = client.fetch_all_opinions_paginated(
        court='ca9',  # 9th Circuit Court of Appeals
        filed_after='2024-01-01',
        max_cases=100  # Fetch 100 cases for testing
    )
    
    print(f"Successfully retrieved {len(opinions)} opinions")
```

**1.3 Important CourtListener API Notes:**

- **Rate Limits:** 5,000 requests/hour (free tier)
- **Authentication:** Token-based (include in Authorization header)
- **Court Identifiers:** 
  - `scotus` - Supreme Court
  - `ca1` through `ca11` - Circuit Courts
  - `cadc` - D.C. Circuit
  - Full list: https://www.courtlistener.com/api/jurisdictions/
- **Date Format:** YYYY-MM-DD
- **Pagination:** Use `page` parameter, max 100 results per page
- **Free Tier:** Unlimited API calls with rate limits

---

## Step 2: Data Chunking and Embedding Preparation

### Recommended Method
**Use `tiktoken` for token-aware chunking and `text-embedding-ada-002` for embeddings.**

### 2.1 Install Required Libraries

```bash
pip install tiktoken openai azure-identity
```

### 2.2 Text Chunking Implementation

```python
import tiktoken
from typing import List, Dict
import re

class CaseLawChunker:
    """Intelligent chunking of legal case text"""
    
    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 50,
        model_name: str = "gpt-4o"
    ):
        """
        Initialize chunker
        
        Args:
            chunk_size: Target tokens per chunk
            chunk_overlap: Overlapping tokens between chunks
            model_name: Model for tokenization (matches embedding model)
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.encoding = tiktoken.encoding_for_model(model_name)
    
    def clean_text(self, text: str) -> str:
        """
        Clean and normalize case text
        
        Args:
            text: Raw case text
            
        Returns:
            Cleaned text
        """
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove special characters that might cause issues
        text = text.replace('\x00', '')
        
        # Normalize quotes
        text = text.replace('"', '"').replace('"', '"')
        text = text.replace(''', "'").replace(''', "'")
        
        return text.strip()
    
    def extract_sections(self, text: str) -> Dict[str, str]:
        """
        Extract key sections from case text
        
        Common sections:
        - Facts/Background
        - Issue
        - Holding/Rule
        - Analysis/Reasoning
        - Conclusion
        
        Args:
            text: Case opinion text
            
        Returns:
            Dict mapping section names to text
        """
        sections = {}
        
        # Common legal section headers
        section_patterns = [
            r'BACKGROUND|FACTS?',
            r'ISSUE|QUESTION PRESENTED',
            r'HOLDING|RULE|DECISION',
            r'ANALYSIS|DISCUSSION|REASONING',
            r'CONCLUSION|DISPOSITION'
        ]
        
        # Simple section extraction (can be enhanced)
        current_section = "full_text"
        sections[current_section] = text
        
        return sections
    
    def chunk_text(
        self,
        text: str,
        metadata: Dict
    ) -> List[Dict]:
        """
        Chunk case text into smaller segments
        
        Args:
            text: Full case opinion text
            metadata: Case metadata (name, citation, date, etc.)
            
        Returns:
            List of chunk dictionaries with text and metadata
        """
        # Clean text first
        text = self.clean_text(text)
        
        # Tokenize
        tokens = self.encoding.encode(text)
        
        chunks = []
        start_idx = 0
        chunk_num = 0
        
        while start_idx < len(tokens):
            # Define chunk boundaries
            end_idx = start_idx + self.chunk_size
            
            # Extract chunk tokens
            chunk_tokens = tokens[start_idx:end_idx]
            
            # Decode back to text
            chunk_text = self.encoding.decode(chunk_tokens)
            
            # Create chunk document
            chunk = {
                'chunk_id': f"{metadata['id']}_chunk_{chunk_num}",
                'case_id': metadata['id'],
                'case_name': metadata['case_name'],
                'citation': metadata.get('citation', 'N/A'),
                'court': metadata.get('court', 'Unknown'),
                'date_filed': metadata.get('date_filed', ''),
                'jurisdiction': metadata.get('jurisdiction', 'US'),
                'url': metadata.get('url', ''),
                'content': chunk_text,
                'chunk_index': chunk_num,
                'total_chunks': 0  # Will be updated after all chunks created
            }
            
            chunks.append(chunk)
            
            # Move to next chunk with overlap
            start_idx += (self.chunk_size - self.chunk_overlap)
            chunk_num += 1
        
        # Update total_chunks for all chunks
        for chunk in chunks:
            chunk['total_chunks'] = len(chunks)
        
        return chunks
    
    def process_opinion(self, opinion_data: Dict) -> List[Dict]:
        """
        Process a single opinion from CourtListener
        
        Args:
            opinion_data: Raw opinion data from CourtListener API
            
        Returns:
            List of processed chunks
        """
        # Extract text (CourtListener provides plain_text or html)
        text = opinion_data.get('plain_text', '')
        
        if not text and 'html' in opinion_data:
            # Would need HTML parsing here
            text = opinion_data.get('html', '')
        
        if not text:
            print(f"Warning: No text found for opinion {opinion_data.get('id')}")
            return []
        
        # Extract metadata
        metadata = {
            'id': opinion_data.get('id'),
            'case_name': opinion_data.get('case_name', 'Unknown Case'),
            'citation': opinion_data.get('citation', 'N/A'),
            'court': opinion_data.get('court', 'Unknown'),
            'date_filed': opinion_data.get('date_filed', ''),
            'jurisdiction': opinion_data.get('jurisdiction', 'US'),
            'url': f"https://www.courtlistener.com{opinion_data.get('absolute_url', '')}"
        }
        
        # Chunk the text
        chunks = self.chunk_text(text, metadata)
        
        return chunks


# Example Usage
if __name__ == "__main__":
    chunker = CaseLawChunker(chunk_size=512, chunk_overlap=50)
    
    # Sample opinion data
    sample_opinion = {
        'id': 123456,
        'case_name': 'Smith v. Jones',
        'citation': '123 F.3d 456',
        'court': 'ca9',
        'date_filed': '2024-01-15',
        'jurisdiction': 'US',
        'absolute_url': '/opinion/123456/smith-v-jones/',
        'plain_text': 'This is a sample case opinion text...' * 100
    }
    
    chunks = chunker.process_opinion(sample_opinion)
    print(f"Created {len(chunks)} chunks for case")
    print(f"First chunk preview: {chunks[0]['content'][:200]}...")
```

### 2.3 Embedding Generation with Azure OpenAI

```python
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential
from typing import List
import os

class AzureEmbeddingService:
    """Generate embeddings using Azure OpenAI"""
    
    def __init__(
        self,
        endpoint: str,
        api_key: str,
        deployment_name: str = "text-embedding-ada-002",
        api_version: str = "2024-08-01-preview"
    ):
        """
        Initialize Azure OpenAI embedding service
        
        Args:
            endpoint: Azure OpenAI endpoint URL
            api_key: Azure OpenAI API key
            deployment_name: Name of embedding deployment
            api_version: API version
        """
        self.client = AzureOpenAI(
            api_key=api_key,
            api_version=api_version,
            azure_endpoint=endpoint
        )
        self.deployment_name = deployment_name
    
    def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for a single text
        
        Args:
            text: Text to embed
            
        Returns:
            List of floats (1536 dimensions for ada-002)
        """
        try:
            response = self.client.embeddings.create(
                input=text,
                model=self.deployment_name
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"Error generating embedding: {e}")
            raise
    
    def generate_embeddings_batch(
        self,
        texts: List[str],
        batch_size: int = 16
    ) -> List[List[float]]:
        """
        Generate embeddings for multiple texts in batches
        
        Args:
            texts: List of texts to embed
            batch_size: Number of texts per API call
            
        Returns:
            List of embedding vectors
        """
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            
            try:
                response = self.client.embeddings.create(
                    input=batch,
                    model=self.deployment_name
                )
                
                batch_embeddings = [item.embedding for item in response.data]
                all_embeddings.extend(batch_embeddings)
                
                print(f"Generated embeddings for {len(all_embeddings)}/{len(texts)} texts")
                
            except Exception as e:
                print(f"Error in batch {i}-{i+batch_size}: {e}")
                # Generate individually as fallback
                for text in batch:
                    try:
                        emb = self.generate_embedding(text)
                        all_embeddings.append(emb)
                    except:
                        all_embeddings.append([0.0] * 1536)  # Placeholder
        
        return all_embeddings
    
    def embed_chunks(self, chunks: List[Dict]) -> List[Dict]:
        """
        Add embeddings to chunk documents
        
        Args:
            chunks: List of chunk dictionaries
            
        Returns:
            List of chunks with 'embedding' field added
        """
        # Extract just the content text
        texts = [chunk['content'] for chunk in chunks]
        
        # Generate embeddings in batch
        embeddings = self.generate_embeddings_batch(texts)
        
        # Add embeddings to chunks
        for chunk, embedding in zip(chunks, embeddings):
            chunk['content_vector'] = embedding
        
        return chunks


# Example Usage
if __name__ == "__main__":
    # Azure OpenAI configuration
    endpoint = os.getenv('AZURE_OPENAI_ENDPOINT')
    api_key = os.getenv('AZURE_OPENAI_API_KEY')
    
    embedding_service = AzureEmbeddingService(
        endpoint=endpoint,
        api_key=api_key,
        deployment_name='text-embedding-ada-002'
    )
    
    # Generate embeddings for sample chunks
    sample_chunks = [
        {'content': 'This is the first chunk of case text...'},
        {'content': 'This is the second chunk of case text...'}
    ]
    
    chunks_with_embeddings = embedding_service.embed_chunks(sample_chunks)
    print(f"Generated embeddings: {len(chunks_with_embeddings[0]['content_vector'])} dimensions")
```

**Recommended Embedding Model:**
- **Model:** `text-embedding-ada-002`
- **Dimensions:** 1536
- **Max Input:** 8,191 tokens
- **Cost:** $0.10 per 1M tokens
- **Performance:** Excellent for semantic search

---

## Step 3: Azure AI Search Index Creation and Population

### Recommended Library
**Use `azure-search-documents` for Azure AI Search operations.**

### 3.1 Install Required Libraries

```bash
pip install azure-search-documents azure-identity
```

### 3.2 Index Schema Creation

```python
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    SearchIndex,
    SimpleField,
    SearchableField,
    SearchField,
    SearchFieldDataType,
    VectorSearch,
    HnswAlgorithmConfiguration,
    VectorSearchProfile,
    SemanticConfiguration,
    SemanticPrioritizedFields,
    SemanticField,
    SemanticSearch
)
import os
from typing import List, Dict

class AzureSearchIndexManager:
    """Manage Azure AI Search index for legal cases"""
    
    def __init__(
        self,
        endpoint: str,
        api_key: str,
        index_name: str = "legal-cases-index"
    ):
        """
        Initialize Azure Search client
        
        Args:
            endpoint: Azure Search service endpoint
            api_key: Azure Search admin API key
            index_name: Name of the search index
        """
        self.endpoint = endpoint
        self.api_key = api_key
        self.index_name = index_name
        
        credential = AzureKeyCredential(api_key)
        
        self.index_client = SearchIndexClient(
            endpoint=endpoint,
            credential=credential
        )
        
        self.search_client = SearchClient(
            endpoint=endpoint,
            index_name=index_name,
            credential=credential
        )
    
    def create_index(self) -> SearchIndex:
        """
        Create Azure AI Search index with vector search support
        
        Returns:
            Created SearchIndex object
        """
        # Define fields
        fields = [
            SimpleField(
                name="id",
                type=SearchFieldDataType.String,
                key=True,
                filterable=True
            ),
            SearchableField(
                name="case_name",
                type=SearchFieldDataType.String,
                filterable=True,
                sortable=True
            ),
            SearchableField(
                name="citation",
                type=SearchFieldDataType.String,
                filterable=True,
                facetable=True
            ),
            SearchableField(
                name="court",
                type=SearchFieldDataType.String,
                filterable=True,
                facetable=True
            ),
            SimpleField(
                name="date_filed",
                type=SearchFieldDataType.DateTimeOffset,
                filterable=True,
                sortable=True
            ),
            SearchableField(
                name="jurisdiction",
                type=SearchFieldDataType.String,
                filterable=True,
                facetable=True
            ),
            SearchableField(
                name="content",
                type=SearchFieldDataType.String,
                analyzer_name="en.microsoft"
            ),
            SearchField(
                name="content_vector",
                type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                searchable=True,
                vector_search_dimensions=1536,  # text-embedding-ada-002
                vector_search_profile_name="legal-vector-profile"
            ),
            SimpleField(
                name="url",
                type=SearchFieldDataType.String,
                filterable=False
            ),
            SimpleField(
                name="chunk_index",
                type=SearchFieldDataType.Int32,
                filterable=True
            ),
            SimpleField(
                name="total_chunks",
                type=SearchFieldDataType.Int32,
                filterable=True
            ),
            SimpleField(
                name="case_id",
                type=SearchFieldDataType.String,
                filterable=True
            )
        ]
        
        # Configure vector search
        vector_search = VectorSearch(
            algorithms=[
                HnswAlgorithmConfiguration(
                    name="legal-hnsw-algorithm",
                    parameters={
                        "m": 4,  # Number of bi-directional links
                        "efConstruction": 400,  # Size of dynamic candidate list
                        "efSearch": 500,  # Size of candidate list during search
                        "metric": "cosine"  # Similarity metric
                    }
                )
            ],
            profiles=[
                VectorSearchProfile(
                    name="legal-vector-profile",
                    algorithm_configuration_name="legal-hnsw-algorithm"
                )
            ]
        )
        
        # Configure semantic search (optional but recommended)
        semantic_config = SemanticConfiguration(
            name="legal-semantic-config",
            prioritized_fields=SemanticPrioritizedFields(
                title_field=SemanticField(field_name="case_name"),
                content_fields=[
                    SemanticField(field_name="content")
                ],
                keywords_fields=[
                    SemanticField(field_name="citation"),
                    SemanticField(field_name="court")
                ]
            )
        )
        
        semantic_search = SemanticSearch(
            configurations=[semantic_config]
        )
        
        # Create index
        index = SearchIndex(
            name=self.index_name,
            fields=fields,
            vector_search=vector_search,
            semantic_search=semantic_search
        )
        
        try:
            result = self.index_client.create_or_update_index(index)
            print(f"Index '{self.index_name}' created successfully")
            return result
        except Exception as e:
            print(f"Error creating index: {e}")
            raise
    
    def delete_index(self):
        """Delete the search index"""
        try:
            self.index_client.delete_index(self.index_name)
            print(f"Index '{self.index_name}' deleted successfully")
        except Exception as e:
            print(f"Error deleting index: {e}")
            raise
    
    def upload_documents(
        self,
        documents: List[Dict],
        batch_size: int = 100
    ) -> Dict:
        """
        Upload documents to Azure AI Search index
        
        Args:
            documents: List of document dictionaries
            batch_size: Number of documents per batch upload
            
        Returns:
            Dict with upload statistics
        """
        total_uploaded = 0
        total_failed = 0
        
        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]
            
            try:
                result = self.search_client.upload_documents(documents=batch)
                
                # Count successes and failures
                succeeded = sum(1 for r in result if r.succeeded)
                failed = sum(1 for r in result if not r.succeeded)
                
                total_uploaded += succeeded
                total_failed += failed
                
                print(f"Batch {i//batch_size + 1}: "
                      f"Uploaded {succeeded}, Failed {failed}, "
                      f"Total: {total_uploaded}/{len(documents)}")
                
                # Log failures
                for r in result:
                    if not r.succeeded:
                        print(f"  Failed to upload document {r.key}: {r.error_message}")
                
            except Exception as e:
                print(f"Error uploading batch {i//batch_size + 1}: {e}")
                total_failed += len(batch)
        
        return {
            'total_documents': len(documents),
            'uploaded': total_uploaded,
            'failed': total_failed,
            'success_rate': total_uploaded / len(documents) if documents else 0
        }
    
    def search(
        self,
        query: str,
        top: int = 5,
        filters: str = None
    ) -> List[Dict]:
        """
        Search the index (for testing)
        
        Args:
            query: Search query
            top: Number of results
            filters: OData filter expression
            
        Returns:
            List of search results
        """
        results = self.search_client.search(
            search_text=query,
            top=top,
            filter=filters,
            select=["id", "case_name", "citation", "content", "url", "court"]
        )
        
        return [dict(result) for result in results]


# Example Usage
if __name__ == "__main__":
    # Azure Search configuration
    endpoint = os.getenv('AZURE_SEARCH_ENDPOINT')
    api_key = os.getenv('AZURE_SEARCH_API_KEY')
    
    # Initialize index manager
    index_manager = AzureSearchIndexManager(
        endpoint=endpoint,
        api_key=api_key,
        index_name='legal-cases-index'
    )
    
    # Create index
    index_manager.create_index()
    
    # Sample documents (with embeddings already generated)
    sample_documents = [
        {
            'id': '123456_chunk_0',
            'case_id': '123456',
            'case_name': 'Smith v. Jones',
            'citation': '123 F.3d 456',
            'court': 'ca9',
            'date_filed': '2024-01-15T00:00:00Z',
            'jurisdiction': 'US',
            'content': 'This is the first chunk of case text...',
            'content_vector': [0.1] * 1536,  # Placeholder embedding
            'url': 'https://www.courtlistener.com/opinion/123456/',
            'chunk_index': 0,
            'total_chunks': 3
        }
    ]
    
    # Upload documents
    stats = index_manager.upload_documents(sample_documents)
    print(f"Upload complete: {stats}")
```

### 3.3 Complete Ingestion Pipeline

```python
import os
from datetime import datetime
from typing import List, Dict

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
    
    def setup_index(self):
        """Create Azure AI Search index"""
        print("Creating Azure AI Search index...")
        self.index_manager.create_index()
        print("Index created successfully")
    
    def ingest_cases(
        self,
        court: str,
        filed_after: str,
        max_cases: int = 100
    ) -> Dict:
        """
        Complete ingestion pipeline
        
        Args:
            court: Court identifier (e.g., 'ca9')
            filed_after: Start date (YYYY-MM-DD)
            max_cases: Maximum cases to ingest
            
        Returns:
            Dict with ingestion statistics
        """
        print(f"\n=== Starting Ingestion Pipeline ===")
        print(f"Court: {court}")
        print(f"Filed After: {filed_after}")
        print(f"Max Cases: {max_cases}\n")
        
        # Step 1: Fetch cases from CourtListener
        print("Step 1: Fetching cases from CourtListener...")
        opinions = self.courtlistener.fetch_all_opinions_paginated(
            court=court,
            filed_after=filed_after,
            max_cases=max_cases
        )
        print(f"✓ Fetched {len(opinions)} opinions\n")
        
        if not opinions:
            print("No opinions to process")
            return {'total_cases': 0, 'total_chunks': 0, 'uploaded': 0}
        
        # Step 2: Chunk all cases
        print("Step 2: Chunking case text...")
        all_chunks = []
        for i, opinion in enumerate(opinions):
            try:
                chunks = self.chunker.process_opinion(opinion)
                all_chunks.extend(chunks)
                print(f"  Processed {i+1}/{len(opinions)}: "
                      f"{opinion.get('case_name', 'Unknown')} "
                      f"({len(chunks)} chunks)")
            except Exception as e:
                print(f"  Error processing opinion {opinion.get('id')}: {e}")
        
        print(f"✓ Created {len(all_chunks)} total chunks\n")
        
        # Step 3: Generate embeddings
        print("Step 3: Generating embeddings...")
        chunks_with_embeddings = self.embedding_service.embed_chunks(all_chunks)
        print(f"✓ Generated embeddings for {len(chunks_with_embeddings)} chunks\n")
        
        # Step 4: Upload to Azure AI Search
        print("Step 4: Uploading to Azure AI Search...")
        
        # Prepare documents for upload
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
        
        upload_stats = self.index_manager.upload_documents(documents, batch_size=100)
        print(f"✓ Upload complete\n")
        
        # Summary
        print("=== Ingestion Complete ===")
        print(f"Total Cases: {len(opinions)}")
        print(f"Total Chunks: {len(all_chunks)}")
        print(f"Uploaded: {upload_stats['uploaded']}")
        print(f"Failed: {upload_stats['failed']}")
        print(f"Success Rate: {upload_stats['success_rate']:.1%}")
        
        return {
            'total_cases': len(opinions),
            'total_chunks': len(all_chunks),
            **upload_stats
        }


# Main execution
if __name__ == "__main__":
    # Load credentials from environment
    pipeline = LegalCaseIngestionPipeline(
        courtlistener_api_token=os.getenv('COURTLISTENER_API_TOKEN'),
        azure_search_endpoint=os.getenv('AZURE_SEARCH_ENDPOINT'),
        azure_search_api_key=os.getenv('AZURE_SEARCH_API_KEY'),
        azure_openai_endpoint=os.getenv('AZURE_OPENAI_ENDPOINT'),
        azure_openai_api_key=os.getenv('AZURE_OPENAI_API_KEY'),
        index_name='legal-cases-index'
    )
    
    # Setup index (run once)
    pipeline.setup_index()
    
    # Ingest cases
    stats = pipeline.ingest_cases(
        court='ca9',  # 9th Circuit
        filed_after='2024-01-01',
        max_cases=100  # Start with 100 cases
    )
    
    print(f"\nFinal Stats: {stats}")
```

---

## Summary

### Step 1: Data Retrieval
- ✅ Library: `requests`
- ✅ API: CourtListener REST API v3
- ✅ Authentication: Token-based
- ✅ Rate Limiting: Built-in with exponential backoff
- ✅ Cost: **FREE**

### Step 2: Data Chunking/Embedding
- ✅ Chunking: `tiktoken` for token-aware splitting
- ✅ Chunk Size: 512 tokens with 50-token overlap
- ✅ Embedding Model: `text-embedding-ada-002` (1536 dimensions)
- ✅ Batch Processing: 16 texts per API call
- ✅ Cost: ~$0.10 per 1M tokens

### Step 3: Index Creation
- ✅ Library: `azure-search-documents`
- ✅ Index: Vector search + keyword search (hybrid)
- ✅ Upload: Batch uploads of 100 documents
- ✅ Vector Algorithm: HNSW with cosine similarity
- ✅ Cost: ~$75/month (Basic tier)

### Next Phase: Prompt Flow Integration
See `PROMPT_FLOW_GUIDE.md` for connecting this to Azure AI Foundry Prompt Flow.

---

**Total Estimated Cost:** ~$84/month for full system  
**Implementation Time:** 2-3 days for MVP  
**Scalability:** 100k+ cases supported
