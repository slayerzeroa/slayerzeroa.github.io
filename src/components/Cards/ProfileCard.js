import React from "react";
import emailIcon from "../assets/email.png";
import graduateIcon from "../assets/graduate.png";
import globeIcon from "../assets/globe.png";
import linkedinIcon from "../assets/linkedin.png";
import "./ProfileCard.css"; // 스타일 정의

function ProfileCard() {
  return (
    <div className="profile-card">
      <img
        className="profile-image"
        src="https://example.com/path-to-your-image.jpg"
        alt="Profile"
      />
      <h2>Seungho (Samuel) Lee</h2>
      <p>Graduate Fellow at Murty Sunak Quantitative and Computing Lab</p>
      <p>Claremont McKenna College</p>
      <div className="icons">
        <a href="mailto:email@example.com">
          <img src={emailIcon} alt="Email" className="icon" />
        </a>
        <a href="https://www.example.com/graduate-program">
          <img src={graduateIcon} alt="Graduate Program" className="icon" />
        </a>
        <a href="https://www.example.com/globe">
          <img src={globeIcon} alt="Globe" className="icon" />
        </a>
        <a href="https://www.linkedin.com/in/seungho-lee/">
          <img src={linkedinIcon} alt="LinkedIn" className="icon" />
        </a>
      </div>
    </div>
  );
}

export default ProfileCard;
