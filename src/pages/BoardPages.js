import React from "react";
import { Route, Link } from "react-router-dom";
import Tistory from "../assets/img/tistory.svg";

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

import BoardDetail from "views/projects-sections/components/BoardDetail";

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
          <Container>
            <Row>
              <Col className="ml-auto mr-auto text-center" md="8">
                <h2 className="title">사람</h2>
                <h5 className="description">그렇다.</h5>
              </Col>
            </Row>
            <div className="separator separator-primary"></div>
            <div className="section-story-overview">
              <Row>
                <Col md="6">
                  <div
                    className="image-container image-left"
                    style={{
                      backgroundImage:
                        "url(" + require("assets/img/login.jpg") + ")",
                    }}
                  >
                    <h2>Go High</h2>
                    <p className="blockquote blockquote-info">
                      높은 목표는 홀로 오르기 어렵습니다. 팀을 만들어 각자의
                      역할을 다할 때 더 높이 갈 수 있습니다.
                      <br></br>
                      <br></br>우리는 여러분들이 더 높은 곳으로 갈 수 있도록
                      지원하고, 함께 갑니다.<br></br>
                    </p>
                  </div>
                  <div
                    className="image-container"
                    style={{
                      backgroundImage:
                        "url(" + require("assets/img/skyscrapers.jpg") + ")",
                    }}
                  >
                    <h2 style={{ color: "white" }}>In Financial Industry</h2>
                  </div>
                </Col>
                <Col md="5">
                  <div
                    className="image-container image-right"
                    style={{
                      backgroundImage:
                        "url(" + require("assets/img/with_us.jpg") + ")",
                    }}
                  >
                    <h2 style={{ color: "white" }}>With Us</h2>
                  </div>

                  <h3>
                    급변하는 금융시장에서 장기적으로 높은 성과를 내는 것은 쉽지
                    않습니다<br></br>
                  </h3>
                  <p>
                    금융공학과의 수업내용을 바탕으로 금융시장의 변화에 대응하고,
                    더 나아가 새로운 접근을 탐구하여 높은 성과를 내는 것을
                    목표로 합니다. 단순히 수업을 듣고 과제를 제출하는 것이 아닌,
                    자신만의 아이디어를 토대로 금융시장에 대한 연구를 진행하고,
                    프로젝트를 진행하여 실제로 적용할 수 있는 결과물을
                    만들어냅니다.
                  </p>
                  <p>
                    Python, R, C++, JavaScript 등 다양한 언어를 활용하여 퀀트
                    분석, 블록체인, 머신러닝, 데이터 사이언스 등 다양한 분야에
                    대한 연구를 진행하고 있습니다. 교내 활동에 더하여 다양한
                    금융 공모전, 해커톤에 참여할 수 있도록 지원합니다. 매주
                    소학회원들과 함께 프로젝트, 알고리즘에 대한 토론을 진행하여
                    자신의 의견을 논리적으로 주장하는 능력을 기르고, 서로의
                    아이디어를 공유합니다.
                  </p>
                  <p>
                    삼성전자, 카카오, LG 등 이미 개발자로서의 커리어를 시작한
                    선배님들과 증권사, 자산운용사, 대학원에서 금융인으로서의
                    커리어를 시작하신 선배님들의 끈끈한 아주대 금융공학
                    네트워크를 통해 취업에 대한 도움을 받을 수 있습니다.
                  </p>
                </Col>
              </Row>
            </div>
          </Container>
        </div>
        <div className="section section-team text-center">
          <Container>
            <h2 className="title">Here is our Executives</h2>
            <div className="team">
              <Row>
                <Col md="4">
                  <div className="team-player">
                    <img
                      alt="..."
                      className="rounded-circle img-fluid img-raised"
                      src={require("assets/img/KKM.png")}
                    ></img>
                    <h4 className="title">냥냥</h4>
                    <p className="category text-info">냥냥</p>
                    <p className="description">
                      I hope you like my website! 😆{" "}
                    </p>
                  </div>
                </Col>
                <Col md="4">
                  <div className="team-player">
                    <img
                      alt="..."
                      className="rounded-circle img-fluid img-raised"
                      src={require("assets/img/YDM.gif")}
                    ></img>
                    <h4 className="title">유대명</h4>
                    <p className="category text-info">사람</p>
                    <p className="description">
                      되면 한다<br></br>
                      즐길 수 없으면 피해라<br></br>
                      몸이 나쁘면 머리가 고생한다<br></br>{" "}
                    </p>
                    <a href="https://github.com/slayerzeroa">
                      <Button className="btn-icon btn-round" color="">
                        <img
                          src={require("../assets/img/github.png")}
                          width="100%"
                          height="100%"
                        />
                      </Button>
                    </a>
                    <a href="https://www.linkedin.com/in/%EB%8C%80%EB%AA%85-%EC%9C%A0-625084183/">
                      <Button className="btn-icon btn-round" color="">
                        <img
                          src={require("../assets/img/linkedin.png")}
                          width="100%"
                          height="100%"
                        />
                      </Button>
                    </a>
                    <a href="https://blog.naver.com/slayerzeroa">
                      <Button className="btn-icon btn-round" color="">
                        <img
                          src={require("../assets/img/naver.png")}
                          width="100%"
                          height="100%"
                        />
                      </Button>
                    </a>
                    <a href="https://stockduck.tistory.com/">
                      <Button className="btn-icon btn-round" color="">
                        <img src={Tistory} width="100%" />
                      </Button>
                    </a>
                  </div>
                </Col>
                <Col md="4">
                  <div className="team-player">
                    <img
                      alt="..."
                      className="rounded-circle img-fluid img-raised"
                      src={require("assets/img/LGC.png")}
                    ></img>
                    <h4 className="title">나는</h4>
                    <p className="category text-info">고라파덕</p>
                    <p className="description">
                      사느냐 죽느냐, 그것이 문제로다
                    </p>
                  </div>
                </Col>
              </Row>
            </div>
          </Container>
        </div>
        <DefaultFooter />
      </div>
    </>
  );
}

export default About;
