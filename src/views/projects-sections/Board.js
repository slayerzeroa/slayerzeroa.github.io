import React, { useEffect, useState } from "react";
import BoardList from "./components/BoardList";
import fm from "front-matter"; // front-matter import
import { Container, Button } from "reactstrap";
import { useLocation, useNavigate } from "react-router-dom"; // Updated: useNavigate instead of useHistory

const Board = () => {
  const [posts, setPosts] = useState([]);
  const postsPerPage = 5; // 페이지당 표시할 게시글 수

  const location = useLocation();
  const navigate = useNavigate(); // Updated: useNavigate to replace useHistory

  // URL에서 쿼리 매개변수로 페이지 번호 추출
  const queryParams = new URLSearchParams(location.search);

  // 이전 페이지 상태가 있으면 그 상태를 사용하고, 없으면 URL에서 쿼리 파라미터로 페이지를 설정
  const initialPage =
    location.state?.currentPage || parseInt(queryParams.get("page")) || 1;
  const [currentPage, setCurrentPage] = useState(initialPage); // 페이지 상태

  useEffect(() => {
    const fetchAllMarkdownFiles = async () => {
      const context = require.context("/public/posts", false, /\.md$/); // require.context를 사용하여 posts 디렉토리의 모든 Markdown 파일을 가져옴
      const postsData = [];

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

      setPosts(postsData);
    };

    fetchAllMarkdownFiles();
  }, []);

  // 현재 페이지에 맞는 게시글만 가져오는 로직
  const indexOfLastPost = currentPage * postsPerPage;
  const indexOfFirstPost = indexOfLastPost - postsPerPage;
  const currentPosts = posts.slice(indexOfFirstPost, indexOfLastPost);

  // 페이지 변경 핸들러 (URL에 페이지 저장)
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    navigate(`?page=${pageNumber}`, { state: { currentPage: pageNumber } }); // URL을 업데이트하며 상태도 전달
  };

  // 전체 페이지 수 계산
  const totalPages = Math.ceil(posts.length / postsPerPage);

  return (
    <div className="section section-navbars">
      <Container id="menu-dropdown">
        <h4>Projects Board</h4>
      </Container>
      <div id="navbar">
        {/* 불러온 게시글 목록을 BoardList로 전달 */}
        {currentPosts.map((post) => (
          <BoardList
            key={post.number}
            number={post.number}
            category={post.category}
            title={post.title}
            date={post.date}
            color="bg-default"
          />
        ))}

        {/* 페이지 네비게이션 UI */}
        <div className="pagination">
          {Array.from({ length: totalPages }, (_, i) => (
            <Button
              key={i + 1}
              color={currentPage === i + 1 ? "primary" : "secondary"}
              onClick={() => handlePageChange(i + 1)}
              style={{ margin: "0 5px" }}
            >
              {i + 1}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Board;
