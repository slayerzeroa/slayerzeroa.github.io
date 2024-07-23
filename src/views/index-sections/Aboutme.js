import React from "react";
// react plugin used to create switch buttons
import Switch from "react-bootstrap-switch";
// plugin that creates slider
import Slider from "nouislider";
import project2_0 from "../../assets/img/psyduck1-rowsize.jpg";
import { colors, width, height } from "../../assets/config/globalStyles"; //width,height 받아오기
import { FaGithub, FaLinkedin } from "react-icons/fa";
import { SiNaver } from "react-icons/si";
import { TbFileCv } from "react-icons/tb";

import "./css/BasicElement.css";

// reactstrap components
import {
  Button,
  Label,
  FormGroup,
  Input,
  InputGroupAddon,
  InputGroupText,
  InputGroup,
  Container,
  Row,
  Col,
  Card,
  CardBody,
  CardTitle,
  CardText,
} from "reactstrap";

// core components

function Aboutme() {
  const [leftFocus, setLeftFocus] = React.useState(false);
  const [rightFocus, setRightFocus] = React.useState(false);
  // React.useEffect(() => {
  //   if (
  //     !document
  //       .getElementById("sliderRegular")
  //       .classList.contains("noUi-target")
  //   ) {
  //     Slider.create(document.getElementById("sliderRegular"), {
  //       start: [50],
  //       connect: [true, false],
  //       step: 0.5,
  //       range: { min: 0, max: 100 },
  //     });
  //   }
  //   if (
  //     !document.getElementById("sliderDouble").classList.contains("noUi-target")
  //   ) {
  //     Slider.create(document.getElementById("sliderDouble"), {
  //       start: [20, 80],
  //       connect: [false, true, false],
  //       step: 1,
  //       range: { min: 0, max: 100 },
  //     });
  //   }
  // });

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = "src/assets/contents/ydm_resume.pdf"; // CV 파일이 위치한 URL
    link.download = "ydm_resume.pdf"; // 다운로드할 때 저장될 파일 이름
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  return (
    <>
      <div className="section section-basic" id="basic-elements">
        <Container>
          <h3 className="title">Programming the Finance, Pricing the World.</h3>
          <h5>
            데이터분석을 통해 퀀트 전략을 검증하고, <br></br>퀀트 전략을 통해
            수익을 창출합니다.<br></br> <br></br> 다양한 분야 및 프로젝트를
            진행합니다.<br></br>
            <br></br>
          </h5>

          <p className="category">Cover</p>
          <Row>
            <Col md="10">
              <Button color="primary" type="button">
                Quantitative Trading / Research
              </Button>
              <Button color="warning" type="button">
                Data Analysis
              </Button>
              <Button color="success" type="button">
                Financial RL
              </Button>
              <Button color="info" type="button">
                Block Chain
              </Button>
              <Button color="default" type="button">
                Simple Level Front, Back, DB
              </Button>
            </Col>
          </Row>
          <p className="category">Using Language</p>
          <Row>
            <Col md="10">
              <Button color="primary" type="button">
                Python
              </Button>
              <Button color="primary" type="button">
                C++
              </Button>
              <Button color="primary" type="button">
                Rust
              </Button>
              <Button color="warning" type="button">
                R
              </Button>
              <Button color="info" type="button">
                JavaScript
              </Button>
              <Button color="info" type="button">
                Solidity
              </Button>
            </Col>
          </Row>
          <p className="category">Using FrameWork</p>
          <Row>
            <Col md="10">
              <Button color="success" type="button">
                Pytorch
              </Button>
              <Button color="warning" type="button">
                Maria DB
              </Button>
              <Button color="default" type="button">
                React.js
              </Button>
              <Button color="default" type="button">
                Express.js
              </Button>
              <Button color="default" type="button">
                Docker
              </Button>
            </Col>
          </Row>
          <p className="category">My Goal</p>
          <Row>
            <Col md="20">
              <Button className="btn-neutral" color="default">
                Make High Quality Quant Service in the Korea
              </Button>
            </Col>
          </Row>
          <h3 className="title">
            <br></br>
            <br></br>About Me
          </h3>
          {/* <img
            src={project2_0}
            style={{ Width: width, display: "block", marginBottom: 10 }}
          ></img> */}
          <Row>
            <Col md="4">
              <Card>
                <img
                  src={project2_0}
                  alt="Project"
                  className="card-img-top"
                  style={{ width: "100%", height: "auto" }}
                />
                <CardBody>
                  <CardTitle tag="h5">DAEMYEONG YOO</CardTitle>
                  <CardText>
                    Graduate of Ajou University <br></br>
                    Financial Engineering Lab
                  </CardText>
                  <div className="icon-buttons">
                    <Button
                      color="primary"
                      href="https://github.com/slayerzeroa"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="icon-button"
                    >
                      <FaGithub />
                    </Button>
                    <Button
                      color="info"
                      href="https://www.linkedin.com/in/slayerzeroa"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="icon-button"
                    >
                      <FaLinkedin />
                    </Button>
                    <Button
                      color="success"
                      href="https://blog.naver.com/slayerzeroa"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="icon-button"
                    >
                      <SiNaver />
                    </Button>
                    <Button
                      color="default"
                      onClick={handleDownload}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="icon-button"
                    >
                      <TbFileCv />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>
    </>
  );
}

export default Aboutme;
