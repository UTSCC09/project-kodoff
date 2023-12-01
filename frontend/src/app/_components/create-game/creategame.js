'use client'

import  React, { useState, useEffect, useRef } from 'react';
import "./styles.css";

export function CreateGame(props) {
  const { createGame, gamePin } = props;
  const uniqueGamePin = useRef(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(uniqueGamePin.current.innerText);
  };

  const handleSubmit = (e) => {
    createGame();
  };

  return (
    <div className="Option_Form d-flex flex-column justify-content-center">
      <div className="Game_Pin d-flex justify-content-between align-items-center">
        <div className="Game_Text d-flex align-items-center"> 
          <div className="Pin_Text">Game Pin</div>
          <div className="Divider"></div>
          <div className="Pin_Text" ref={uniqueGamePin}>{gamePin}</div>
        </div>
        <button type="submit" className="Icon_Button" onClick={handleCopy}>
          <i className="bi bi-clipboard Icon"></i>
        </button>
      </div>
      <button type="submit" className="Join_Btn align-self-stretch w-100" onClick={handleSubmit}>Create Game</button>
    </div>
  )
}

export default CreateGame;