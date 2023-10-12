import { useContext, useReducer, useRef } from 'react';
import { MasterContext } from '../context';
import locations from './../data/locations.json';
import professions from './../data/professions.json';

const CONTACTS = ['phone', 'whatsapp', 'telegram', 'instagram', 'email'];

export default function AddNewRecord() {
  const { state, dispatch } = useContext(MasterContext);
  const { masters } = state;

  const nameRef = useRef();

  return (
    <>
      <form
        id="add-new-piggy"
        onSubmit={(e) => {
          e.preventDefault();
          console.log(nameRef.current.value);
        }}
      >
        <label>
          Ваше імʼя:
          <input type="text" ref={nameRef} />
        </label>
        <br />
        <label>
          Оберіть професію зі списку.
          <select>
            {professions.map((profession) => (
              <option key={profession.id} value={profession.id}>
                {profession.name.ua}
              </option>
            ))}
          </select>
        </label>
        <br />
        <label>
          Оберіть найближче велике місто.
          <select>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.city.ua}
              </option>
            ))}
          </select>
        </label>
        <br />
        <label>
          Як з вами звʼязатися?
          {CONTACTS.map((contactName) => (
            <>
              <br />
              <label>
                {contactName}
                <input type="text"></input>
              </label>
            </>
          ))}
        </label>
        <br />
        <label>
          Стисло про себе
          <br />
          <textarea name="" id="" cols="30" rows="6"></textarea>
        </label>
        <br />
        <button type="submit">Submit</button>
      </form>
    </>
  );
}
/*

  Ваше імʼя:
  Оберіть професію зі списку. *не можу знайти
  Оберіть найближче велике місто
  Як з вами звʼязатися?
  Стисло про вас, наприклад "Сертифікований масажист з 10-річним стажем, маю досвід роботи з важкими проблемами: захворювання хребта, реабілітація травм, спайки, розходження тазових кісток, суглобні проблеми"
  Фото: Якщо у вас є фото вашої роботи, прикладіть (максимум 4 фото)

  --- Дякуємо! Протягом 24 годин ваш профіль зʼявиться на сайті. --- 

*/
