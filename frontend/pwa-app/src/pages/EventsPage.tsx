import React from "react";
import { Navigate } from "react-router-dom";

const EventsPage: React.FC = () => {
  return <Navigate to="/events/upcoming" replace />;
};

export default EventsPage;

