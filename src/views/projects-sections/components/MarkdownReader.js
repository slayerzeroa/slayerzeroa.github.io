import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import fm from "front-matter"; // front-matter import

const MarkdownReader = ({ postId }) => {
  const [content, setContent] = useState("");
  const [metaData, setMetaData] = useState({
    title: "",
    date: "",
    category: "",
  });

  useEffect(() => {
    // Markdown 파일을 읽어오는 함수
    const fetchMarkdown = async () => {
      try {
        // 게시글 번호에 맞는 파일 경로 생성
        const response = await fetch(`/posts/post${postId}.md`);
        if (response.ok) {
          const markdownText = await response.text();

          // front-matter를 사용하여 메타데이터와 본문 파싱
          const parsed = fm(markdownText);
          const { attributes, body } = parsed;

          // 메타데이터 설정
          setMetaData({
            title: attributes.title || "Untitled",
            date: attributes.date || "Unknown Date",
            category: attributes.category || "Uncategorized",
          });

          // 본문 내용 설정
          setContent(body);
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
      {/* 메타데이터 출력 */}
      <h1>
        <strong>{metaData.title}</strong>
      </h1>
      <p>
        {metaData.category} {metaData.date}
      </p>
      <br></br>
      <br></br>

      {/* Markdown 본문 출력 */}
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
};

export default MarkdownReader;
