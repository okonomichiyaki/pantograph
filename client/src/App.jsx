import React from 'react';
import { useEffect, useState, useRef } from 'react';
import { io } from "socket.io-client";

// Represents the status of web socket connection + webrtc call
class Status {
    static Connecting = new Status('Connecting', 'connecting to server...');
    static Connected = new Status('Connected', 'connected to server.');
    static Waiting = new Status('Waiting', 'waiting for opponent...');
    static Ready = new Status('Ready', 'ready to start call');
    static Offered = new Status('Offered', 'sent offer, waiting for answer');
    static Answered = new Status('Answered', 'received answer');

    constructor(name, description) {
        this.name = name;
        this.description = description;
    }
    isBusy() {
        return this === Status.Connecting;
    }
    toString() {
        return `State.${this.name}`;
    }
}

export default function App() {
    const [status, setStatus] = useState(Status.Connecting);
    const [socket, setSocket] = useState(io());
    useEffect(() => {
        socket.on('connect', function() {
            setStatus(Status.Connected);
            socket.emit('join', {username: 'x'});
        });
        socket.on('disconnect', function() {
            setStatus(Status.Connecting);
        });
    }, [socket]);

    return (
        <div className="container-fluid">
          <Navigation status={status}/>
          <div className="main">
            <div className="left-panel">
              <Video origin="remote"/>
              <Controls/>
            </div>
            <div className="right-panel">
              <Video origin="local"/>
              <Card title="Time Bomb" code="33069" src="https://static.nrdbassets.com/v1/large/33069.jpg" />
            </div>
          </div>
        </div>
    );
}

function Video({origin}) {
    return <img className={origin} src={origin + ".png"} alt="placeholder"/>;
}

function StatusIndicator({ status }) {
    return (
        <div className="status">
          <span aria-busy={ status.isBusy() }>{ status.description }</span>
        </div>
    );
}

function Navigation(props) {
    return (
        <nav>
          <ul><Branding/></ul>
          <ul>
            <li><StatusIndicator {...props}/></li>
            <li><a href="#" role="button">logout</a></li>
          </ul>
        </nav>
    );
}

function Controls() {
    function handleClick() {
        alert('You clicked me!');
    }
    return (
        <nav>
          <ul>
            <li><a href="#" role="button">hangup</a></li>
            <li><a href="#" role="button" onClick={handleClick}>call</a></li>
            {/* <li><a href="#" role="button"></a></li> */}
            <li>
              <select defaultValue="loading">
                <option value="loading">loading...</option>
              </select>
            </li>
          </ul>
        </nav>
    );
}

function BrandingFull() {
    return (
        <div>
          <Branding/>
          <h2>paper netrunner over webcam</h2>
        </div>
    );
}

function Branding() {
    return <h1>pantograph <img src="Pantograph.webp" alt=""/></h1>;
}

function Card({ title, code, src }) {
    return <img className="card" src={src} alt={title} />;
}
