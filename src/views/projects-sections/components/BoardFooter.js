// components/BoardFooter.js
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
    <div>
      <Container>
        <Row>
          <Col className="ml-auto mr-auto text-center" md="8">
            <h2 className="title">
              지식에 투자하는 것은 항상 최대의 수익을 준다.
            </h2>
            <h5 className="description">
              시간이 흘러도 지식에 투자하는 것이 여전히 최대의 수익을 낳는다.
            </h5>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default BoardFooter;
