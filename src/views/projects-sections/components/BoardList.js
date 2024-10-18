import React from "react";
import { useNavigate } from "react-router-dom";
import { Navbar, NavbarBrand, Container } from "reactstrap";

const BoardList = ({ number, category, title, date }) => {
  const navigate = useNavigate();

  // 카테고리별 색상 정의
  const categoryColors = {
    ML: "bg-primary", // Machine Learning
    Finance: "bg-success", // Finance
    AI: "bg-info", // AI
    default: "bg-default", // 기본 색상
  };

  // 카테고리에 따른 색상 설정 (없는 경우 기본 색상 사용)
  const color = categoryColors[category] || categoryColors.default;

  const handleClick = () => {
    // 클릭 시 경로를 변경
    navigate(`/projects/${number}`);
  };

  return (
    <Navbar
      className={color}
      expand="md"
      style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
      onClick={handleClick} // 클릭 시 이동하는 함수
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
  );
};

export default BoardList;
