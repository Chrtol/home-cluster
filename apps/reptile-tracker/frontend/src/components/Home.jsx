import React from 'react';
import { Link } from 'react-router-dom';

function Home() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-2">Welcome!</h2>
          <p className="text-gray-600 dark:text-gray-400">This is your Reptile Tracker dashboard. More widgets and stats coming soon!</p>
        </div>
        <Link to="/reptiles" className="card hover:shadow-lg hover:border-primary-500/50 transition-all">
          <h2 className="text-xl font-bold mb-2">Manage Reptiles</h2>
          <p className="text-gray-600 dark:text-gray-400">View, add, or edit your reptiles.</p>
        </Link>
        <Link to="/feed" className="card hover:shadow-lg hover:border-primary-500/50 transition-all">
          <h2 className="text-xl font-bold mb-2">Log a Feeding</h2>
          <p className="text-gray-600 dark:text-gray-400">Quickly log a new feeding for one of your reptiles.</p>
        </Link>
      </div>
    </div>
  );
}

export default Home;
