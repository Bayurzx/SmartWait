export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            SmartWait
          </h1>
          <p className="text-gray-600">
            Virtual Queue Management System
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Skip the Waiting Room
            </h2>
            
            <div className="space-y-3">
              <a 
                href="/checkin" 
                className="btn btn-primary w-full text-lg py-3"
              >
                Check In Now
              </a>
              
              <a 
                href="/staff" 
                className="btn btn-secondary w-full"
              >
                Staff Dashboard
              </a>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-blue-900 mb-3">How it works:</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li className="flex items-start">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold mr-2 mt-0.5">1</span>
              Check in with your name, phone, and appointment time
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold mr-2 mt-0.5">2</span>
              Get your queue position and estimated wait time
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold mr-2 mt-0.5">3</span>
              Wait anywhere and return when it's your turn
            </li>
          </ul>
        </div>

        {/* Benefits */}
        <div className="text-center text-sm text-gray-600 space-y-1">
          <p>✓ Avoid crowded waiting rooms</p>
          <p>✓ Get real-time queue updates</p>
          <p>✓ Wait from anywhere nearby</p>
        </div>
      </div>
    </div>
  );
}