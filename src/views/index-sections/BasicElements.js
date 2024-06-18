import React from "react";
// react plugin used to create switch buttons
import Switch from "react-bootstrap-switch";
// plugin that creates slider
import Slider from "nouislider";
import project1 from "../../assets/img/project1.jpg";
import project2_0 from "../../assets/img/psyduck1.jpg";
import { colors, width, height } from "../../assets/config/globalStyles"; //width,height 받아오기

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
} from "reactstrap";

// core components

function BasicElements() {
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
                Make High Quality Service in the Financial Industry
              </Button>
            </Col>
          </Row>
          <h3>
            <br></br>
            <br></br>About Me
          </h3>
          <img
            src={project2_0}
            style={{ Width: width, display: "block", marginBottom: 10 }}
          ></img>
        </Container>
      </div>
    </>
  );
}

export default BasicElements;
