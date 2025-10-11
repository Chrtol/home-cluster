import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import axios from "../api/axios";

function ReptileForm() {
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState("");
  const { reptileId } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const isEditing = Boolean(reptileId);

  useEffect(() => {
    if (isEditing && auth.isAuthenticated) {
      axios
        .get(`/reptiles/${reptileId}`)
        .then((response) => {
          const { name, species, birth_date, sex } = response.data;
          setName(name);
          setSpecies(species);
          setBirthDate(birth_date);
          setSex(sex);
        })
        .catch((error) => console.error("Error fetching reptile:", error));
    }
  }, [reptileId, isEditing, auth.isAuthenticated]);

  const handleSubmit = (e) => {
    e.preventDefault();

    const reptileData = { name, species, birth_date: birthDate, sex };

    const request = isEditing
      ? axios.put(`/reptiles/${reptileId}`, reptileData)
      : axios.post("/reptiles", reptileData);

    request
      .then(() => {
        navigate("/reptiles");
      })
      .catch((error) => console.error("Error saving reptile:", error));
  };

  if (!auth.isAuthenticated) {
    return null;
  }

  return (
    <div>
      <h2>{isEditing ? "Edit" : "Add"} Reptile</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Name:
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
        </div>
        <div>
          <label>
            Species:
            <input
              type="text"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              required
            />
          </label>
        </div>
        <div>
          <label>
            Birth Date:
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
            />
          </label>
        </div>
        <div>
          <label>
            Sex:
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              required
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
        </div>
        <button type="submit">{isEditing ? "Update" : "Create"} Reptile</button>
      </form>
    </div>
  );
}

export default ReptileForm;