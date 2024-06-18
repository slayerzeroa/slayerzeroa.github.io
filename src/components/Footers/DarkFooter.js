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
              <a
                href="https://fepsi.netlify.app/index"
                target="_blank"
              >
                FEPSI
              </a>
            </li>
            <li>
              <a
                href="https://blog.naver.com/slayerzeroa"
                target="_blank"
              >
                Blog
              </a>
            </li>
            <li>
              <a
                href="https://fepsi.netlify.app/index"
                target="_blank"
              >
                Contact Us : slayerzeroa@naver.com
              </a>
            </li>
          </ul>
        </nav>
      </Container>
    </footer>
  );
}

export default DarkFooter;
