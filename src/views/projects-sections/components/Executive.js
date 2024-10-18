// 글 아래 작가 소개

import React from "react";
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

function BoardFooter() {
  return (
    <div className="section section-team text-center">
      <Container>
        <h2 className="title">introduce</h2>
        <div className="team">
          <Row>
            <Col />
            <Col md="4">
              <div className="team-player">
                <a href="https://blog.naver.com/slayerzeroa">
                  <img
                    alt="..."
                    className="rounded-circle img-fluid img-raised"
                    src={require("assets/img/YDM.gif")}
                  ></img>
                </a>
                <h4 className="title">유대명</h4>
                <p className="category text-info"></p>
                <p className="description">
                  되면 한다<br></br>
                  안되면 배운다
                </p>
                <a href="https://github.com/slayerzeroa">
                  <Button className="btn-icon btn-round" color="">
                    <img
                      src={require("../../../assets/img/github.png")}
                      width="100%"
                      height="100%"
                    />
                  </Button>
                </a>
                <a href="https://www.linkedin.com/in/%EB%8C%80%EB%AA%85-%EC%9C%A0-625084183/">
                  <Button className="btn-icon btn-round" color="">
                    <img
                      src={require("../../../assets/img/linkedin.png")}
                      width="100%"
                      height="100%"
                    />
                  </Button>
                </a>
                <a href="https://blog.naver.com/slayerzeroa">
                  <Button className="btn-icon btn-round" color="">
                    <img
                      src={require("../../../assets/img/naver.png")}
                      width="100%"
                      height="100%"
                    />
                  </Button>
                </a>
              </div>
            </Col>
            <Col />
          </Row>
        </div>
      </Container>
    </div>
  );
}

export default BoardFooter;
