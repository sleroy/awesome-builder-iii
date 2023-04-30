<template>
  <a class="btn btn-primary z-0 ml-auto py-[14px]" @click="action">
    {{ !isLoggedIn ? lbl_signin : lbl_signout }}
  </a>
</template>

<script lang="ts">
import * as AmazonCognitoIdentity from "amazon-cognito-identity-js";
import { userPool, isSessionValid } from "../../auth/userPool";

interface Data {
  isLoggedIn: boolean;
  user: null | AmazonCognitoIdentity.CognitoUser;
}

export default {
  props: ["lbl_signin", "lbl_signout", "url_signin"],
  created() {},
  data(): Data {
    return {
      isLoggedIn: false,
      user: null,
    };
  },
  mounted() {
    this.user = userPool.getCurrentUser();
    this.isLoggedIn = isSessionValid();
  },
  methods: {
    action: function () {
      if (this.isLoggedIn) {
        const user: AmazonCognitoIdentity.CognitoUser | null =
          userPool.getCurrentUser();
        if (user != null) {
          user.signOut(() => {
            console.log("Sign out");
            window.open("/", "_self")
          });
        }
        this.isLoggedIn = false;
      } else {
        this.isLoggedIn = false;
        window.open(this.url_signin, "_self");
      }
    },
  },
};
</script>
