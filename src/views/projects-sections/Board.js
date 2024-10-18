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

// import React, { useEffect, useState } from "react";
// import BoardList from "./components/BoardList";
// import fm from "front-matter"; // front-matter import
// import { Container } from "reactstrap";

// const Board = () => {
//   const publicUrl = process.env.PUBLIC_URL; // PUBLIC_URL 환경 변수를 통해 경로 설정
//   const [posts, setPosts] = useState([]);

//   useEffect(() => {
//     const fetchAllMarkdownFiles = async () => {
//       const postsData = [];

//       // 예시로 posts 1, 2, 3이 있다고 가정
//       const postIds = [1, 2, 3]; // 실제 게시글 수에 맞춰 수정하세요

//       for (const postId of postIds) {
//         try {
//           // PUBLIC_URL 경로를 사용하여 정적 파일에 접근
//           const response = await fetch(`/posts/post${postId}.html`);

//           if (!response.ok) {
//             console.warn(`File not found: post${postId}.html`);
//             continue;
//           }

//           const markdownText = await response.text();

//           // Markdown 파일에서 메타데이터와 본문을 파싱
//           const parsed = fm(markdownText);
//           const { attributes } = parsed;

//           // 메타데이터를 사용해 게시글 목록에 추가
//           postsData.push({
//             number: postId,
//             title: attributes.title || `Post ${postId}`,
//             date: attributes.date || "Unknown Date",
//             category: attributes.category || "Uncategorized",
//           });
//         } catch (error) {
//           console.error(`Error loading post ${postId}:`, error);
//         }
//       }

//       // 상태에 게시글 목록 저장
//       setPosts(postsData);
//     };

//     fetchAllMarkdownFiles();
//   }, [publicUrl]);

//   return (
//     <div className="section section-navbars">
//       <Container id="menu-dropdown">
//         <h4>Projects Board</h4>
//       </Container>
//       <div id="navbar">
//         {posts.map((post) => (
//           <BoardList
//             key={post.number}
//             number={post.number}
//             category={post.category}
//             title={post.title}
//             date={post.date}
//             color="bg-default"
//           />
//         ))}
//       </div>
//     </div>
//   );
// };

// export default Board;

// import ReactMarkdown from "react-markdown";

// import React, { useEffect, useState } from "react";
// import BoardList from "./components/BoardList";
// import fm from "front-matter"; // front-matter import
// import { Container } from "reactstrap";

// const Board = () => {
//   const [posts, setPosts] = useState([]);

//   useEffect(() => {
//     const fetchAllMarkdownFiles = async () => {
//       // 게시글 목록을 담을 배열
//       const postsData = [];

//       // 예시로 posts 1, 2, 3을 불러온다고 가정
//       const postIds = [1, 2, 3]; // 실제로는 이 목록을 서버나 API로부터 받아올 수 있습니다.

//       for (const postId of postIds) {
//         try {
//           const response = await fetch(`/posts/post${postId}.md`);
//           const markdownText = await response.text();

//           // Markdown 파일에서 메타데이터와 본문을 파싱
//           const parsed = fm(markdownText);
//           const { attributes } = parsed;

//           // 메타데이터를 사용해 게시글 목록에 추가
//           postsData.push({
//             number: postId,
//             title: attributes.title || `Post ${postId}`,
//             date: attributes.date || "Unknown Date",
//             category: attributes.category || "Uncategorized",
//           });
//         } catch (error) {
//           console.error(`Error loading post ${postId}:`, error);
//         }
//       }

//       // 상태에 게시글 목록 저장
//       setPosts(postsData);
//     };

//     fetchAllMarkdownFiles();
//   }, []);

//   return (
//     <div className="section section-navbars">
//       <Container id="menu-dropdown">
//         <h4>Projects Board</h4>
//       </Container>
//       <div id="navbar">
//         {/* 불러온 게시글 목록을 BoardList로 전달 */}
//         {posts.map((post) => (
//           <BoardList
//             key={post.number}
//             number={post.number}
//             category={post.category}
//             title={post.title}
//             date={post.date}
//             color="bg-default"
//           />
//         ))}
//       </div>
//     </div>
//   );
// };

// export default Board;

// // 동적 게시판 목록 테스트
// import React, { useEffect, useState } from "react";
// import BoardList from "./components/BoardList";
// import fm from "front-matter"; // front-matter import
// import { Container } from "reactstrap";

// const Board = () => {
//   const [posts, setPosts] = useState([]);

//   useEffect(() => {
//     const fetchAllMarkdownFiles = async () => {
//       const postsData = [];

//       // 파일 개수에 따라 동적으로 postIds 생성 (예: 1부터 5까지 파일이 있다고 가정)
//       const numberOfPosts = 5; // 실제 게시글 개수에 맞게 설정
//       for (let i = 1; i <= numberOfPosts; i++) {
//         const postId = `post${i}`;
//         const filename = `${postId}.md`;

//         try {
//           // public/posts 디렉토리에서 파일을 fetch로 가져옴
//           const response = await fetch(`/posts/${filename}`);

//           // 파일이 존재하지 않으면 목록에 추가하지 않음
//           if (!response.ok) {
//             console.warn(`File not found: ${filename}`);
//             continue; // 파일이 없으면 건너뜀
//           }

//           const markdownText = await response.text();

//           // Markdown 파일에서 메타데이터와 본문을 파싱
//           const parsed = fm(markdownText);
//           const { attributes } = parsed;

//           // 메타데이터를 사용해 게시글 목록에 추가
//           postsData.push({
//             number: postId.replace("post", ""),
//             title: attributes.title || `Post ${postId}`,
//             date: attributes.date || "Unknown Date",
//             category: attributes.category || "Uncategorized",
//           });
//         } catch (error) {
//           console.error(`Error loading post ${postId}:`, error);
//         }
//       }

//       // 상태에 게시글 목록 저장
//       setPosts(postsData);
//     };

//     fetchAllMarkdownFiles();
//   }, []);

//   return (
//     <div className="section section-navbars">
//       <Container id="menu-dropdown">
//         <h4>Projects Board</h4>
//       </Container>
//       <div id="navbar">
//         {/* 불러온 게시글 목록을 BoardList로 전달 */}
//         {posts.map((post) => (
//           <BoardList
//             key={post.number}
//             number={post.number}
//             category={post.category}
//             title={post.title}
//             date={post.date}
//             color="bg-default"
//           />
//         ))}
//       </div>
//     </div>
//   );
// };

// export default Board;
