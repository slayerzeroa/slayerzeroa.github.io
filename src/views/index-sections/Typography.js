import React from "react";

// reactstrap components
import { Container, Row, Col } from "reactstrap";

// core components

function Typography() {
  return (
    <>
      <Container>
        <h3 className="title">Duckstory</h3>
        <div id="history">
          <Row>
            <Col md="12">
              <div className="history-line">
                <span>2024</span>
                <h5>
                  KRX 전국 대학생 증권 · 파생상품 경시대회 1위<br></br>{" "}
                  DB금융경제공모전 증권/자산운용 부문 가작
                </h5>
              </div>
              <div className="history-line">
                <span>2023</span>
                <h5>
                  WorldQuant IQC Korea 2nd<br></br>
                  신한 빅데이터 해커톤; 신한투자증권 우수상<br></br>
                  동교인재상; 산업, 경영 부문<br></br>
                  아주대학교 경영대학 학술제 금상 (Weekly VKOSPI)
                </h5>
              </div>
              <div className="history-line">
                <span>2022</span>
                <h5>
                  아주대학교 경영대학 학술제 금상 (Option Pricing With
                  Deeplearning)<br></br>
                  아주대학교 프로그래밍 콘테스트 Div2. 우수상<br></br>
                  DB GAPS 금융동아리 5위
                </h5>
              </div>
              <div className="history-line">
                <span>고등학생</span>
                <h5>
                  인천광역시교육청 수학탐구발표대회 은상, 동상<br></br>
                </h5>
              </div>
              <div className="history-line">
                <span>2001</span>
                <h5>응애</h5>
              </div>
            </Col>
          </Row>
        </div>
      </Container>
    </>
  );
}

export default Typography;
