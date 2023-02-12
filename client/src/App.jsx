import React from 'react';

export default class App extends React.Component {
    // constructor(props) {
    //     super(props);
    // }

    render() {
        return (
            <div className="container-fluid">
              <Navigation/>
              <Main/>
            </div>
        );
    }
}

function Main() {
    return (
        <div className="main">
          <div className="left-panel">
            <Video origin="remote"/>
            <Controls/>
          </div>
          <div className="right-panel">
            <Video origin="local"/>
            <Card title="Time Bomb" code="33069" src="https://static.nrdbassets.com/v1/large/33069.jpg" />
            {/* <CardSearchResults alternatives={["Fermenter", "Botulus"]}/> */}
          </div>
        </div>
    );
}

function Video({origin}) {
    return <img className={origin} src={origin + ".png"} alt="placeholder"/>;
}

function Status() {
    return (
        <div className="status">
          <span aria-busy="true">waiting for opponent...</span>
        </div>
    );
}

function Navigation() {
    return (
        <nav>
          <ul><Branding/></ul>
          <ul>
            <li><Status/></li>
            <li><a href="#" role="button">logout</a></li>
          </ul>
        </nav>
    );
}

function Controls() {
    return (
        <nav>
          <ul>
            <li><a href="#" role="button">hangup</a></li>
            {/* <li><a href="#" role="button"></a></li> */}
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

function CardSearchResults({ alternatives }) {
    return (
        <ul className="card-search-results">
        {alternatives.map(alternative => <li>{alternative}</li>)}
        </ul>
    );
}

function Card({ title, code, src }) {
    return <img className="card" src={src} alt={title} />;
}
