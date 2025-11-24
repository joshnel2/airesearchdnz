import LegalResearchInterface from '@/components/LegalResearchInterface';

export default function Home() {
  return (
    <main className="h-screen bg-white flex flex-col">
      {/* Top Bar - Legal Research */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Legal Research Tool</h1>
                <p className="text-xs text-gray-500">Powered by Thomson Reuters Westlaw & AI</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              <span>Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Full Screen Legal Research Interface */}
      <div className="flex-1 overflow-hidden">
        <LegalResearchInterface />
      </div>
    </main>
  );
}
