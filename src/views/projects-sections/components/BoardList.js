import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Collapse,
  Navbar,
  NavbarBrand,
  Nav,
  NavItem,
  NavLink,
  Container,
} from "reactstrap";

const BoardList = ({ number, category, title, date, color }) => {
  const [collapseOpen, setCollapseOpen] = useState(false);

  return (
    <Link
      to={`/projects/${number}`} // 클릭 시 이동할 경로 설정
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <Navbar
        className={color}
        expand="md"
        style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
      >
        <Container
          fluid
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "76%",
            padding: 0,
          }}
        >
          {/* 왼쪽에 숫자와 카테고리 표시 */}
          <div style={{ display: "flex", flex: 1, marginLeft: "1rem" }}>
            <NavbarBrand>{number}</NavbarBrand>
            <NavbarBrand>{category}</NavbarBrand>
          </div>

          {/* 중앙에 타이틀 표시 */}
          <NavbarBrand style={{ flex: 2, textAlign: "center" }}>
            {title}
          </NavbarBrand>

          {/* 오른쪽에 날짜 표시 */}
          <NavbarBrand
            style={{ flex: 1, textAlign: "right", marginRight: "1rem" }}
          >
            {date}
          </NavbarBrand>
        </Container>
      </Navbar>
    </Link>
  );
};

export default BoardList;
