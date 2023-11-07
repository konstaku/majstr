import 'react-phone-input-2/lib/style.css';

import PhoneInput from 'react-phone-input-2';
import locations from './../data/locations.json';
import professions from './../data/professions.json';
import { useContext } from 'react';
import { MasterContext } from '../context';
import { useForm } from 'react-hook-form';

export default function AddNewRecord() {
  const { state, dispatch } = useContext(MasterContext);
  const { user } = state;
  const { register, handleSubmit, watch } = useForm();

  const onSubmit = (data) => {
    console.log(data);
    fetch('https://api.konstaku.com:5000/addmaster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  };

  return (
    <>
      <form id="add-new-piggy" onSubmit={handleSubmit(onSubmit)}>
        <div className="input-field">
          <label>
            Ваше імʼя:
            <input
              {...register('name')}
              placeholder="Ваше імʼя"
              defaultValue={user.firstName && user.firstName}
            />
          </label>
        </div>

        <div className="input-field">
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
        </div>

        <div className="input-field">
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
        </div>

        <div className="input-field">
          <label>
            Як з вами звʼязатися?
            <PhoneInput
              country={'it'}
              countryCodeEditable
              enableSearch
            ></PhoneInput>
            <label>
              <input type="checkbox" defaultChecked />
              Телефон
            </label>
            <label>
              <input type="checkbox" />
              Whatsapp
            </label>
            <label>
              <input type="checkbox" />
              Viber
            </label>
          </label>
        </div>

        <div className="input-field">
          <label>
            Instagram:
            <input {...register('instagram')} />
          </label>
        </div>

        <div className="input-field">
          <label>
            Telegram:
            <input
              {...register('telegram')}
              defaultValue={user.username && user.username}
            />
          </label>
        </div>

        <div className="input-field">
          <label>
            Інформація про вас
            <br />
            <textarea {...register('about')} cols="30" rows="6"></textarea>
          </label>
        </div>

        <button type="submit">Submit</button>
      </form>
    </>
  );
}
