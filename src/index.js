import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Route, Routes, Navigate } from "react-router-dom";

// styles for this kit
import "assets/css/bootstrap.min.css";
import "assets/scss/now-ui-kit.scss?v=1.5.0";
import "assets/demo/demo.css?v=1.5.0";
import "assets/demo/nucleo-icons-page-styles.css?v=1.5.0";

// pages for this kit
import Index from "pages/Index.js";
import NucleoIcons from "views/NucleoIcons.js";
import LoginPage from "views/examples/LoginPage.js";
import LandingPage from "views/examples/LandingPage.js";
import ProfilePage from "views/examples/ProfilePage.js";
import About from "pages/About";
import Projects from "pages/Projects";
import Members from "pages/Members";
import FE from "pages/FE";
import Contact from "pages/Contact";
import Activities from "pages/Activities";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <HashRouter>
    <Routes>
      <Route path="/activities" element={<Activities />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/fe" element={<FE />} />
      <Route path="/members" element={<Members />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/index" element={<Index />} />
      <Route path="/about" element={<About />} />
      <Route path="/nucleo-icons" element={<NucleoIcons />} />
      <Route path="/landing-page" element={<LandingPage />} />
      <Route path="/profile-page" element={<ProfilePage />} />
      <Route path="/login-page" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/index" />} />
      <Route path="/projects/:id" element={<Projects />} />
    </Routes>
  </HashRouter>,
);
