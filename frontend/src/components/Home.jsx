import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import axios from "../api/axios";

function Home() {
  const [reptiles, setReptiles] = useState([]);
  const auth = useAuth();

  useEffect(() => {
    if (auth.isAuthenticated) {
      axios
        .get("/reptiles")
        .then((response) => {
          setReptiles(response.data);
        })
        .catch((error) => {
          console.error("Error fetching reptiles:", error);
        });
    }
  }, [auth.isAuthenticated]);

  const handleDelete = (id) => {
    axios
      .delete(`/reptiles/${id}`)
      .then(() => {
        setReptiles(reptiles.filter((reptile) => reptile.id !== id));
      })
      .catch((error) => {
        console.error("Error deleting reptile:", error);
      });
  };

  if (!auth.isAuthenticated) {
    return (
      <div>
        <h1>Welcome to the Reptile App</h1>
        <p>Please log in to see your reptiles.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Your Reptiles</h1>
      <Link to="/add-reptile">Add a new reptile</Link>
      <ul>
        {reptiles.map((reptile) => (
          <li key={reptile.id}>
            {reptile.name} - {reptile.species}
            <button onClick={() => handleDelete(reptile.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Home;