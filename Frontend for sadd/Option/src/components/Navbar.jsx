export default function Navbar() {
  return (
    <nav className="w-full bg-white shadow p-4 flex items-center justify-between">
      <div className="text-2xl font-extrabold text-blue-700 tracking-tight">Comfea</div>
      <div className="hidden md:flex space-x-6 text-base font-medium">
        <a href="#" className="text-gray-700 hover:text-blue-600 transition">Home</a>
        <a href="#" className="text-gray-700 hover:text-blue-600 transition">Buy</a>
        <a href="#" className="text-gray-700 hover:text-blue-600 transition">Rent</a>
        <a href="#" className="text-gray-700 hover:text-blue-600 transition">Sell</a>
        <a href="#" className="text-gray-700 hover:text-blue-600 transition">About</a>
        <a href="#" className="text-gray-700 hover:text-blue-600 transition">Contact</a>
      </div>
      <div>
        <button className="ml-6 px-5 py-2 bg-blue-600 text-white rounded-full font-semibold shadow hover:bg-blue-700 transition">Sign In</button>
      </div>
    </nav>
  );
} 