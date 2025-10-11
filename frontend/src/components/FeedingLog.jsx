import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "../api/axios";
import { useAuth } from "react-oidc-context";

function FeedingLog() {
  const [foods, setFoods] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [feedingDate, setFeedingDate] = useState("");
  const [selectedFood, setSelectedFood] = useState("");
  const [selectedSupplement, setSelectedSupplement] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [feedings, setFeedings] = useState([]);
  const [reptile, setReptile] = useState(null);
  const { reptileId } = useParams();
  const auth = useAuth();

  useEffect(() => {
    if (auth.isAuthenticated) {
      axios
        .get(`/reptiles/${reptileId}`)
        .then((response) => setReptile(response.data))
        .catch((error) =>
          console.error("Error fetching reptile details:", error)
        );
      axios
        .get("/foods")
        .then((response) => setFoods(response.data))
        .catch((error) => console.error("Error fetching foods:", error));
      axios
        .get("/supplements")
        .then((response) => setSupplements(response.data))
        .catch((error) => console.error("Error fetching supplements:", error));
      axios
        .get(`/feedings/reptile/${reptileId}`)
        .then((response) => setFeedings(response.data))
        .catch((error) => console.error("Error fetching feedings:", error));
    }
  }, [reptileId, auth.isAuthenticated]);

  const handleLogFeeding = (e) => {
    e.preventDefault();

    const feedingData = {
      reptile_id: reptileId,
      food_id: selectedFood,
      supplement_id: selectedSupplement || null,
      quantity: quantity,
      feeding_date: feedingDate,
    };

    axios
      .post("/feedings", feedingData)
      .then((response) => {
        setFeedings([...feedings, response.data]);
      })
      .catch((error) => console.error("Error logging feeding:", error));
  };

  const foodItems = foods.filter((food) => food.category === "item");
  const preparedFoods = foods.filter((food) => food.category === "prepared");

  if (!auth.isAuthenticated) {
    return <div>Please log in to view the feeding log.</div>;
  }

  return (
    <div>
      <h1>Feeding Log for {reptile ? reptile.name : "Loading..."}</h1>
      <h2>Log a Feeding</h2>
      <form onSubmit={handleLogFeeding}>
        <input
          type="date"
          value={feedingDate}
          onChange={(e) => setFeedingDate(e.target.value)}
          required
        />
        <select
          value={selectedFood}
          onChange={(e) => setSelectedFood(e.target.value)}
          required
        >
          <option value="">Select Food</option>
          <optgroup label="Food Items">
            {foodItems.map((food) => (
              <option key={food.id} value={food.id}>
                {food.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Prepared">
            {preparedFoods.map((food) => (
              <option key={food.id} value={food.id}>
                {food.name}
              </option>
            ))}
          </optgroup>
        </select>
        <select
          value={selectedSupplement}
          onChange={(e) => setSelectedSupplement(e.target.value)}
        >
          <option value="">Select Supplement (Optional)</option>
          {supplements.map((supplement) => (
            <option key={supplement.id} value={supplement.id}>
              {supplement.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          min="1"
          required
        />
        <button type="submit">Log Feeding</button>
      </form>
      <h2>Previous Feedings</h2>
      <ul>
        {feedings.map((feeding) => (
          <li key={feeding.id}>
            {feeding.feeding_date}: {feeding.quantity}x{" "}
            {feeding.food_id} {feeding.supplement_id && `+ ${feeding.supplement_id}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default FeedingLog;