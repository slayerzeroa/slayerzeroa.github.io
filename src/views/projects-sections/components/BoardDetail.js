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

// // components/BoardDetail.js
// import React, { useEffect, useState } from "react";
// import { useParams } from "react-router-dom";

// function BoardDetail() {
//   const { id } = useParams(); // URL에서 id를 가져옴
//   const [content, setContent] = useState("");

//   useEffect(() => {
//     const fetchHtmlContent = async () => {
//       try {
//         // 게시글 번호에 맞는 HTML 파일을 fetch로 가져옴
//         const response = await fetch(`/posts/post${id}.html`);
//         if (!response.ok) {
//           setContent("<h3>게시글을 찾을 수 없습니다.</h3>");
//           return;
//         }

//         const htmlContent = await response.text();
//         setContent(htmlContent);
//       } catch (error) {
//         console.error("Error fetching HTML content:", error);
//         setContent("<h3>게시글을 로드하는 중 오류가 발생했습니다.</h3>");
//       }
//     };

//     fetchHtmlContent();
//   }, [id]);

//   return (
//     <div>
//       <h2>게시글 {id}</h2>
//       {/* dangerouslySetInnerHTML로 HTML을 렌더링 */}
//       <div dangerouslySetInnerHTML={{ __html: content }} />
//     </div>
//   );
// }

// export default BoardDetail;
