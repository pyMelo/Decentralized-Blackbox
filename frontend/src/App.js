import React from "react";
import TransactionGraph from "./components/TransactionGraph";
import "bootstrap/dist/css/bootstrap.min.css";

function App() {
  return (
    <div className="container mt-5">
      <h1 className="text-center">Explorer Transazioni</h1>
      <TransactionGraph />
    </div>
  );
}

export default App;
