/**
 * Declare Cognito User pool.
 */
import * as AmazonCognitoIdentity from "amazon-cognito-identity-js";
var poolData = {
  //UserPoolId: "us-east-",
  //ClientId: "",
};
export const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

export function isSessionValid() {
  const cognitoUser = userPool.getCurrentUser();

  let isSessionValid = false;

  if (cognitoUser) {
    cognitoUser.getSession((err: any, result: AmazonCognitoIdentity.CognitoUserSession) => {
      if (!err) {
        isSessionValid = result.isValid();
      } else {
        console.error("Session cannot be checked")
      }
    });
  }

  return isSessionValid;
}
