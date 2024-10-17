// components/MarkdownPost.js
import React from "react";
import ReactMarkdown from "react-markdown";

const MarkdownPost = ({ content }) => {
  return (
    <div className="markdown-content">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
};

export default MarkdownPost;
