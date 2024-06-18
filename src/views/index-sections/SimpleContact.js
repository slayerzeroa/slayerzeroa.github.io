import React from "react";
import { useNavigate } from "react-router-dom";
// react plugin used to create switch buttons
import Switch from "react-bootstrap-switch";
// plugin that creates slider
import Slider from "nouislider";

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

function SimpleContact() {
  const navigate = useNavigate();

  const [leftFocus, setLeftFocus] = React.useState(false);
  const [rightFocus, setRightFocus] = React.useState(false);

  const handleButtonClick = () => {
    navigate("/contact");
  };

  return (
    <>
      <div className="section section-basic" id="basic-elements">
        <Container>
          <h3 className="title">
            <br></br>
            <br></br>
            Contact Me
          </h3>
          <p className="category">
            Go High, or Go Home <br></br> 프로젝트, 스터디, 논문, 채용
          </p>
          <Button color="success" type="button" onClick={handleButtonClick}>
            Could I help you?
          </Button>
        </Container>
      </div>
    </>
  );
}

export default SimpleContact;
