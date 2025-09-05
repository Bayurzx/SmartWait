export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            SmartWait
          </h1>
          <p className="text-gray-600">
            Virtual Queue Management System
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold mb-4">Check In Options</h2>
            
            <div className="space-y-3">
              <a 
                href="/checkin" 
                className="btn btn-primary w-full"
              >
                Patient Check-In
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
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Avoid crowded waiting rooms</p>
          <p>Get real-time queue updates</p>
        </div>
      </div>
    </div>
  );
}