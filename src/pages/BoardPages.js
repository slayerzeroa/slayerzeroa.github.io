import React from "react";
import { Route, Link } from "react-router-dom";

// reactstrap components
import {
  Button,
  Input,
  InputGroupAddon,
  InputGroupText,
  InputGroup,
  Container,
  Row,
  Col,
} from "reactstrap";

// core components
import IndexNavbar from "components/Navbars/IndexNavbar.js";
import AboutHeader from "components/Headers/AboutHeader.js";
import DefaultFooter from "components/Footers/DefaultFooter.js";
import { ReactComponent as TistoryIcon } from "../assets/img/tistory.svg";
import Board from "views/projects-sections/Board.js";
import BoardDetail from "views/projects-sections/components/BoardDetail";
import BoardFooter from "views/projects-sections/components/BoardFooter";
import Executive from "views/projects-sections/components/Executive";

function About() {
  const [firstFocus, setFirstFocus] = React.useState(false);
  const [lastFocus, setLastFocus] = React.useState(false);
  React.useEffect(() => {
    document.body.classList.add("landing-page");
    document.body.classList.add("sidebar-collapse");
    document.documentElement.classList.remove("nav-open");
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    return function cleanup() {
      document.body.classList.remove("landing-page");
      document.body.classList.remove("sidebar-collapse");
    };
  }, []);
  return (
    <>
      <IndexNavbar />
      <div className="wrapper">
        <AboutHeader />
        <div className="section section-about-us">
          <BoardDetail />
          <BoardFooter />
          <Board />
        </div>
        <Executive />
        <DefaultFooter />
      </div>
    </>
  );
}

export default About;
