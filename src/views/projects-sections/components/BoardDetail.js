// components/BoardDetail.js
import React from "react";
import { useParams } from "react-router-dom";
import MarkdownReader from "./MarkdownReader";

function BoardDetail() {
  const { id } = useParams(); // URL에서 id를 가져옴

  return (
    <div>
      <h2>게시글 {id}</h2>
      <MarkdownReader postId={id} />
    </div>
  );
}

export default BoardDetail;
