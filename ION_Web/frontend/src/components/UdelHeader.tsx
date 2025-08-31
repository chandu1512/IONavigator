import React from "react";

type Props = { onUpload?: () => void };

const UdelHeader: React.FC<Props> = ({ onUpload }) => {
  return (
    <nav className="udel-nav">
      <div className="udel-nav__inner">
        <div className="udel-brand">
          <div className="udel-brand__logo" />
          <div className="udel-brand__text">HPC I/O Navigator</div>
        </div>
        <div className="udel-actions">
          <button className="btn btn--gold" onClick={onUpload}>
            Upload New Trace
          </button>
        </div>
      </div>
    </nav>
  );
};

export default UdelHeader;
