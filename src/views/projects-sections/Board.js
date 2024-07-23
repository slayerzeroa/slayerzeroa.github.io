import React from "react";

// reactstrap components
import {
  Collapse,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  UncontrolledDropdown,
  NavbarBrand,
  Navbar,
  NavItem,
  NavLink,
  Nav,
  Container,
  Row,
  Col,
} from "reactstrap";

import BoardList from "./components/BoardList";

// core components

function Board() {
  const [collapseOpen, setCollapseOpen] = React.useState(false);
  return (
    <>
      <div className="section section-navbars">
        <Container id="menu-dropdown">
          <h4>Projects Board</h4>
        </Container>
        <div id="navbar">
          <div>
            <BoardList
              number="0"
              category="ML"
              title="AI MAchineLearning Learningsadsasadasdsa"
              date="2024-07-24"
              color="bg-default"
              //   color = "bg-primary", "bg-info", "bg-success", "bg-warning", "bg-danger", "bg-default", "bg-neutral"
            />
          </div>
          <div>
            <BoardList
              number="1"
              category="finance"
              title="financial engineeringgggggggggg"
              date="2024-07-24"
              color="bg-default"
            />
          </div>
          <div>
            <BoardList
              number="2"
              category="ML"
              title="AI MAchineLearning Learningsadsasadasdsa"
              date="2024-07-24"
              color="bg-default"
            />
          </div>
          <div>
            <BoardList
              number="3"
              category="ML"
              title="AI MAchineLearning Learningsadsasadasdsa"
              date="2024-07-24"
              color="bg-default"
            />
          </div>
          <div>
            <BoardList
              number="4"
              category="ML"
              title="AI MAchineLearning Learningsadsasadasdsa"
              date="2024-07-24"
              color="bg-default"
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default Board;
