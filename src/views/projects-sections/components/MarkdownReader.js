// components/MarkdownReader.js
import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

const MarkdownReader = ({ postId }) => {
  const [content, setContent] = useState("");

  useEffect(() => {
    // Markdown 파일을 읽어오는 함수
    const fetchMarkdown = async () => {
      try {
        // 게시글 번호에 맞는 파일 경로 생성
        const response = await fetch(`/posts/post${postId}.md`);
        if (response.ok) {
          const text = await response.text();
          setContent(text);
        } else {
          console.error("Markdown file not found");
          setContent("# 게시글을 찾을 수 없습니다.");
        }
      } catch (error) {
        console.error("Error fetching markdown file:", error);
      }
    };

    fetchMarkdown();
  }, [postId]);

  return (
    <div style={{ padding: "20px", backgroundColor: "#f9f9f9" }}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
};

export default MarkdownReader;
