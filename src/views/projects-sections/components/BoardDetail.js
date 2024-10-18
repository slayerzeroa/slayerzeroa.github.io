// components/BoardDetail.js
import React from "react";
import { useParams } from "react-router-dom";
import MarkdownReader from "./MarkdownReader";
import "./BoardDetail.css"; // CSS 파일 임포트

function BoardDetail() {
  const { id } = useParams(); // URL에서 id를 가져옴

  return (
    <div className="markdown-container">
      <MarkdownReader postId={id} />
    </div>
  );
}

export default BoardDetail;
