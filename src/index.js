/*

=========================================================
* Now UI Kit React - v1.5.1
=========================================================

* Product Page: https://www.creative-tim.com/product/now-ui-kit-react
* Copyright 2022 Creative Tim (http://www.creative-tim.com)
* Licensed under MIT (https://github.com/creativetimofficial/now-ui-kit-react/blob/main/LICENSE.md)

* Designed by www.invisionapp.com Coded by www.creative-tim.com

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

*/
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";

// styles for this kit
import "assets/css/bootstrap.min.css";
import "assets/scss/now-ui-kit.scss?v=1.5.0";
import "assets/demo/demo.css?v=1.5.0";
import "assets/demo/nucleo-icons-page-styles.css?v=1.5.0";
// pages for this kit
import Index from "views/Index.js";
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

// import BoardDetail from "views/projects-sections/components/BoardDetail.js";
import BoardPages from "pages/BoardPages";
import Board from "views/projects-sections/Board";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <BrowserRouter>
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
      <Route path="/projects/:id" element={<BoardPages />} />
    </Routes>
  </BrowserRouter>
);
