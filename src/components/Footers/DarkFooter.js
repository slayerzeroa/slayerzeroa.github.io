/*eslint-disable*/
import React from "react";

// reactstrap components
import { Container } from "reactstrap";

function DarkFooter() {
  return (
    <footer className="footer" data-background-color="black">
      <Container>
        <nav>
          <ul>
            <li>
              <a href="https://slayerzeroa.github.io/" target="_blank">
                slayerzeroa
              </a>
            </li>
            <li>
              <a href="https://blog.naver.com/slayerzeroa" target="_blank">
                BLOG
              </a>
            </li>
            <li>
              <a target="_blank">Contact ME: slayerzeroa@naver.com</a>
            </li>
            <li>
              <a href="https://github.com/slayerzeroa" target="_blank">
                GITHUB
              </a>
            </li>
          </ul>
        </nav>
      </Container>
    </footer>
  );
}

export default DarkFooter;
