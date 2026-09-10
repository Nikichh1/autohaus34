(function(){
  "use strict";
  var SUPABASE_URL="https://ajoiqomflplhadyhxvfe.supabase.co";
  var SUPABASE_KEY="sb_publishable_gBEUBrOjT_JsBRjAnGL9PQ_ra-1hY0g";
  var form=document.getElementById("setup-form"), email=document.getElementById("email"), password=document.getElementById("password"), confirmPassword=document.getElementById("password-confirm"), showPassword=document.getElementById("show-password"), submit=document.getElementById("submit"), result=document.getElementById("result");
  function show(text,type){result.hidden=false;result.textContent=text;result.className="setup-result "+(type||"");}
  showPassword.addEventListener("change",function(){var type=this.checked?"text":"password";password.type=type;confirmPassword.type=type;});
  form.addEventListener("submit",async function(e){
    e.preventDefault();
    var code=new URLSearchParams(location.search).get("code")||"";
    var mail=email.value.trim().toLowerCase(), pass=password.value;
    if(!code){show("Липсва еднократният setup код.","is-error");return;}
    if(pass.length<12){show("Паролата трябва да е поне 12 знака.","is-error");password.focus();return;}
    if(pass!==confirmPassword.value){show("Двете пароли не съвпадат.","is-error");confirmPassword.focus();return;}
    submit.disabled=true;submit.textContent="Създаване…";show("Създавам защитения admin акаунт…","");
    try{
      var signup=await fetch(SUPABASE_URL+"/auth/v1/signup",{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:mail,password:pass,data:{bootstrap_code:code}})});
      var signupData=await signup.json().catch(function(){return {};});
      if(!signup.ok) throw new Error(signupData.msg||signupData.message||signupData.error_description||signupData.error||"Admin setup failed");
      var local=await fetch("/api/admin/auth?action=login",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:mail,password:pass})});
      password.value="";confirmPassword.value="";
      if(local.ok){
        show("Готово. Администраторът е създаден успешно. Пренасочвам те към admin панела…","is-ok");
        setTimeout(function(){location.replace("/admin");},700);
        return;
      }
      show("Администраторът е създаден успешно. Отвори /admin/login.html и влез с имейла и паролата, които току-що избра.","is-ok");
      submit.textContent="Admin е създаден";
    }catch(err){
      show(err&&err.message?err.message:"Setup failed","is-error");submit.disabled=false;submit.textContent="Опитай отново";
    }
  });
})();
