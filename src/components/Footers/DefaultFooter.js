/*eslint-disable*/
import React from "react";

// reactstrap components
import { Container } from "reactstrap";

// core components

function DefaultFooter() {
  return (
    <>
      <footer className="footer footer-default">
        <Container>
          <nav>
            <ul>
              <li>
                <a href="https://blog.naver.com/slayerzeroa" target="_blank">
                  Blog
                </a>
              </li>
              <li>
                <a href="https://blog.naver.com/slayerzeroa" target="_blank">
                  Contact: slayerzeroa@naver.com
                </a>
              </li>
            </ul>
          </nav>
        </Container>
      </footer>
    </>
  );
}

export default DefaultFooter;
