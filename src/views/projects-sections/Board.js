import React, { useEffect, useState } from "react";
import BoardList from "./components/BoardList";
import fm from "front-matter"; // front-matter import
import { Container } from "reactstrap";

const Board = () => {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const fetchAllMarkdownFiles = async () => {
      const context = require.context("/public/posts", false, /\.md$/); // require.context를 사용하여 posts 디렉토리의 모든 Markdown 파일을 가져옴
      const postsData = [];

      // context.keys()로 파일 목록을 순회하면서 각 파일을 처리
      for (const key of context.keys()) {
        const filename = key.replace("./", ""); // './' 부분을 제거한 파일명
        const postId = filename.replace("post", "").replace(".md", ""); // 'post'와 '.md' 둘 다 제거

        try {
          // 파일을 fetch로 가져와서 내용을 읽음
          const response = await fetch(`/posts/${filename}`);
          const markdownText = await response.text();

          // Markdown 파일에서 메타데이터와 본문을 파싱
          const parsed = fm(markdownText);
          const { attributes } = parsed;

          // 메타데이터를 사용해 게시글 목록에 추가
          postsData.push({
            number: postId,
            title: attributes.title || `Post ${postId}`,
            date: attributes.date || "Unknown Date",
            category: attributes.category || "Uncategorized",
          });
        } catch (error) {
          console.error(`Error loading post ${postId}:`, error);
        }
      }

      // 상태에 게시글 목록 저장
      setPosts(postsData);
    };

    fetchAllMarkdownFiles();
  }, []);

  return (
    <div className="section section-navbars">
      <Container id="menu-dropdown">
        <h4>Projects Board</h4>
      </Container>
      <div id="navbar">
        {/* 불러온 게시글 목록을 BoardList로 전달 */}
        {posts.map((post) => (
          <BoardList
            key={post.number}
            number={post.number}
            category={post.category}
            title={post.title}
            date={post.date}
            color="bg-default"
          />
        ))}
      </div>
    </div>
  );
};

export default Board;
