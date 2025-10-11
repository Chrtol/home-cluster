import React, { useState, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import axios from "../api/axios";

function FoodManagement() {
  const [foods, setFoods] = useState([]);
  const [newFoodName, setNewFoodName] = useState("");
  const [newFoodCategory, setNewFoodCategory] = useState("");
  const [editingFoodId, setEditingFoodId] = useState(null);
  const auth = useAuth();

  useEffect(() => {
    if (auth.isAuthenticated) {
      axios
        .get("/foods")
        .then((response) => {
          setFoods(response.data);
        })
        .catch((error) => {
          console.error("Error fetching foods:", error);
        });
    }
  }, [auth.isAuthenticated]);

  const handleAddFood = () => {
    const newFoodData = { name: newFoodName, category: newFoodCategory };
    axios
      .post("/foods", newFoodData)
      .then((response) => {
        setFoods([...foods, response.data]);
        setNewFoodName("");
        setNewFoodCategory("");
      })
      .catch((error) => {
        console.error("Error adding food:", error);
      });
  };

  const handleUpdateFood = (id) => {
    const foodToUpdate = foods.find((food) => food.id === id);
    const updatedFoodData = {
      name: foodToUpdate.name,
      category: foodToUpdate.category,
    };
    axios
      .put(`/foods/${id}`, updatedFoodData)
      .then((response) => {
        setFoods(
          foods.map((food) => (food.id === id ? response.data : food))
        );
        setEditingFoodId(null);
      })
      .catch((error) => {
        console.error("Error updating food:", error);
      });
  };

  const handleDeleteFood = (id) => {
    axios
      .delete(`/foods/${id}`)
      .then(() => {
        setFoods(foods.filter((food) => food.id !== id));
      })
      .catch((error) => {
        console.error("Error deleting food:", error);
      });
  };

  if (!auth.isAuthenticated) {
    return <div>Please log in to manage foods.</div>;
  }

  return (
    <div>
      <h1>Food Management</h1>
      <div>
        <input
          type="text"
          placeholder="Food Name"
          value={newFoodName}
          onChange={(e) => setNewFoodName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Food Category"
          value={newFoodCategory}
          onChange={(e) => setNewFoodCategory(e.target.value)}
        />
        <button onClick={handleAddFood}>Add Food</button>
      </div>
      <ul>
        {foods.map((food) => (
          <li key={food.id}>
            {editingFoodId === food.id ? (
              <div>
                <input
                  type="text"
                  value={food.name}
                  onChange={(e) =>
                    setFoods(
                      foods.map((f) =>
                        f.id === food.id ? { ...f, name: e.target.value } : f
                      )
                    )
                  }
                />
                <input
                  type="text"
                  value={food.category}
                  onChange={(e) =>
                    setFoods(
                      foods.map((f) =>
                        f.id === food.id
                          ? { ...f, category: e.target.value }
                          : f
                      )
                    )
                  }
                />
                <button onClick={() => handleUpdateFood(food.id)}>
                  Save
                </button>
                <button onClick={() => setEditingFoodId(null)}>Cancel</button>
              </div>
            ) : (
              <div>
                {food.name} - {food.category}
                <button onClick={() => setEditingFoodId(food.id)}>Edit</button>
                <button onClick={() => handleDeleteFood(food.id)}>Delete</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default FoodManagement;