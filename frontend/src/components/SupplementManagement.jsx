import React, { useState, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import axios from "../api/axios";

function SupplementManagement() {
  const [supplements, setSupplements] = useState([]);
  const [newSupplementName, setNewSupplementName] = useState("");
  const [editingSupplementId, setEditingSupplementId] = useState(null);
  const auth = useAuth();

  useEffect(() => {
    if (auth.isAuthenticated) {
      axios
        .get("/supplements")
        .then((response) => {
          setSupplements(response.data);
        })
        .catch((error) => {
          console.error("Error fetching supplements:", error);
        });
    }
  }, [auth.isAuthenticated]);

  const handleAddSupplement = () => {
    if (!newSupplementName.trim()) return;
    const newSupplementData = { name: newSupplementName };
    axios
      .post("/supplements", newSupplementData)
      .then((response) => {
        setSupplements([...supplements, response.data]);
        setNewSupplementName("");
      })
      .catch((error) => {
        console.error("Error adding supplement:", error);
      });
  };

  const handleUpdateSupplement = (id) => {
    const supplementToUpdate = supplements.find((sup) => sup.id === id);
    axios
      .put(`/supplements/${id}`, { name: supplementToUpdate.name })
      .then(() => {
        setEditingSupplementId(null);
      })
      .catch((error) => {
        console.error("Error updating supplement:", error);
      });
  };

  const handleDeleteSupplement = (id) => {
    axios
      .delete(`/supplements/${id}`)
      .then(() => {
        setSupplements(supplements.filter((sup) => sup.id !== id));
      })
      .catch((error) => {
        console.error("Error deleting supplement:", error);
      });
  };

  const handleEditChange = (id, newName) => {
    setSupplements(
      supplements.map((sup) =>
        sup.id === id ? { ...sup, name: newName } : sup
      )
    );
  };

  if (!auth.isAuthenticated) {
    return <div>Please log in to manage supplements.</div>;
  }

  return (
    <div>
      <h2>Manage Supplements</h2>
      <div>
        <input
          type="text"
          value={newSupplementName}
          onChange={(e) => setNewSupplementName(e.target.value)}
          placeholder="New supplement name"
        />
        <button onClick={handleAddSupplement}>Add Supplement</button>
      </div>
      <ul>
        {supplements.map((supplement) => (
          <li key={supplement.id}>
            {editingSupplementId === supplement.id ? (
              <>
                <input
                  type="text"
                  value={supplement.name}
                  onChange={(e) =>
                    handleEditChange(supplement.id, e.target.value)
                  }
                />
                <button onClick={() => handleUpdateSupplement(supplement.id)}>
                  Save
                </button>
                <button onClick={() => setEditingSupplementId(null)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                {supplement.name}
                <button onClick={() => setEditingSupplementId(supplement.id)}>
                  Edit
                </button>
                <button onClick={() => handleDeleteSupplement(supplement.id)}>
                  Delete
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SupplementManagement;
