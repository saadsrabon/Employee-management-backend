export default function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center py-24 bg-gradient-to-br from-blue-50 to-blue-100 overflow-hidden">
      <div className="z-10 max-w-2xl mx-auto text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold text-blue-800 mb-4 leading-tight">Find Your Dream Home</h1>
        <p className="text-lg md:text-2xl text-gray-600 mb-8">Discover the best properties in your city with Comfea.</p>
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 w-full max-w-xl mx-auto">
          <input type="text" placeholder="Search by city, address, or ZIP" className="w-full md:w-2/3 px-5 py-3 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 text-lg" />
          <button className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white rounded-full font-semibold shadow hover:bg-blue-700 transition">Search</button>
        </div>
      </div>
      {/* Decorative background image/shape */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Example: Add a blurred circle or SVG for effect */}
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-blue-200 rounded-full opacity-30 blur-3xl"></div>
      </div>
    </section>
  );
} 