// // components/BoardDetail.js
// import React from "react";
// import { useParams } from "react-router-dom";
// import MarkdownReader from "./MarkdownReader";
// import "./BoardDetail.css"; // CSS 파일 임포트

// function BoardDetail() {
//   const { id } = useParams(); // URL에서 id를 가져옴

//   return (
//     <div className="markdown-container">
//       <MarkdownReader postId={id} />
//     </div>
//   );
// }

// export default BoardDetail;

import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import MarkdownReader from "./MarkdownReader";
import "./BoardDetail.css"; // CSS 파일 임포트

function BoardDetail() {
  const { id } = useParams(); // URL에서 id를 가져옴
  const [hasError, setHasError] = useState(false); // 에러 상태 관리
  const [loading, setLoading] = useState(true); // 로딩 상태 관리

  useEffect(() => {
    // 에러나 로딩 상태를 초기화
    setHasError(false);
    setLoading(false);

    // MarkdownReader에서 데이터를 가져오는 비동기 작업 처리
    const fetchData = async () => {
      try {
        // MarkdownReader가 데이터를 가져오는 시간을 흉내냄
        // 실제로는 MarkdownReader에서 에러 처리를 포함한 적절한 API 호출을 하겠지만,
        // 여기서는 setTimeout을 사용하여 비동기 동작을 시뮬레이트
        setTimeout(() => {
          if (!id) {
            throw new Error("Invalid post ID");
          }
          setLoading(false); // 정상적인 데이터가 로드되었을 경우 로딩 상태 종료
        }, 1000); // 1초 후에 완료로 간주
      } catch (error) {
        setHasError(true); // 에러 발생 시 에러 상태로 전환
        setLoading(false); // 로딩 상태 종료
      }
    };

    fetchData();
  }, [id]);

  if (loading) {
    // 데이터가 로드 중일 때 로딩 메시지 표시
    return <div className="markdown-container">Loading...</div>;
  }

  if (hasError || !id) {
    // 에러가 발생하거나 ID가 유효하지 않을 때 에러 메시지 표시
    return <div className="markdown-container"></div>;
  }

  return (
    <div className="markdown-container">
      <MarkdownReader postId={id} />
    </div>
  );
}

export default BoardDetail;
