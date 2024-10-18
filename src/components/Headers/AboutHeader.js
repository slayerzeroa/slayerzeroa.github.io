import React from "react";

// reactstrap components
import { Button, Container } from "reactstrap";
import { Dimensions } from "react-native";

// core components
import Tunnel from "assets/videos/Tunnel.mp4";

import { StyleSheet, View, TouchableOpacity, Text } from "react-native";
import { colors, width, height } from "../../assets/config/globalStyles"; //width,height 받아오기

function AboutHeader() {
  let pageHeader = React.createRef();

  React.useEffect(() => {
    if (window.innerWidth > 991) {
      const updateScroll = () => {
        let windowScrollTop = window.pageYOffset / 3;
        pageHeader.current.style.transform =
          "translate3d(0," + windowScrollTop + "px,0)";
      };
      window.addEventListener("scroll", updateScroll);
      return function cleanup() {
        window.removeEventListener("scroll", updateScroll);
      };
    }
  });
  return (
    <>
      <div
        className="page-header page-header-small content-center"
        style={{ objectFit: "cover" }}
      >
        <video
          src={Tunnel}
          autoPlay
          playsInline
          loop
          muted
          width={"100%"}
          alignself="center"
        />
        {/* <div
          className="page-header-video"
          

          className="page-header-image"
          style={{
            backgroundImage: "url(" + require("assets/img/bg6.jpg") + ")"
          }}
          ref={pageHeader}
        ></div> */}
        <div className="content-center" style={styles.header}>
          <p className="title">
            {/* I find α Opportunities,<br></br>
              We're pricing Everything<br></br><br></br> */}
            Everything is Information,<br></br>
            Information makes Worth
          </p>
        </div>
      </div>
    </>
  );
}

export default AboutHeader;

const styles = StyleSheet.create({
  header: {
    fontSize: width * 8,
  },
});
