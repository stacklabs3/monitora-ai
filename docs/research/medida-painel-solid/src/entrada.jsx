import { render } from "solid-js/web";
import { Navigate, Route, Router } from "@solidjs/router";
import { PaginaDeBusca } from "./PaginaDeBusca.jsx";
import "./estilo.css";

render(
  () => (
    <Router>
      <Route path="/" component={() => <Navigate href="/busca" />} />
      <Route path="/busca/:identificadorDoEvento?" component={PaginaDeBusca} />
    </Router>
  ),
  document.getElementById("raiz"),
);
