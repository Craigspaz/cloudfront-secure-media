// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React, { useEffect, useState } from "react";
import "./App.css";
import Home from "./Home";
import { Amplify } from "aws-amplify";
import { getCurrentUser, signOut as amplifySignOut, fetchAuthSession } from "aws-amplify/auth";
import { withAuthenticator } from "@aws-amplify/ui-react";
import awsmobile from "../aws-exports";
import "@aws-amplify/ui-react/styles.css";

Amplify.configure(awsmobile);

function App(props) {
  const [username, setUsername] = useState();
  const [token, setToken] = useState();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async function () {
      try {
        const session = await fetchAuthSession();
        const user = await getCurrentUser();
        setUsername(user.username);
        setToken(session.tokens.accessToken.toString());
      } catch (e) {
        console.error("Error, no logged user ", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signOut = async () => {
    try {
      await amplifySignOut();
      window.location.reload();
    } catch (err) {
      console.log("error signing out: ", err);
    }
  };

  if (loading || !username || !token) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container">
          <span className="navbar-brand">🔒 Secure Media Player</span>
          <div className="navbar-nav ms-auto">
            <span className="navbar-text me-3">Welcome, {username}</span>
            <button className="btn btn-outline-light btn-sm" onClick={signOut}>
              Sign Out
            </button>
          </div>
        </div>
      </nav>
      <Home username={username} token={token} onSignOut={signOut} {...props} />
    </div>
  );
}

export default withAuthenticator(App);
